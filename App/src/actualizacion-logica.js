// =====================================================
// Oddinote — saber si hay una versión nueva (window.OdiActualiza)
//
// El usuario quiere que «la más mínima actualización que suba a GitHub, aunque
// esté en la misma versión», avise para actualizar. Comparando solo el número
// de versión, una sustitución (otra build de la misma 1.2.1) no avisaba nunca.
//
// Por eso cada publicación lleva escondido en sus notas el número de build:
//     <!-- odinote-build: 237 -->
// (un comentario de HTML: GitHub no lo enseña). Hay versión nueva si la de
// GitHub es mayor, o si es la misma y su build es mayor que la nuestra
// (window.ODINOTE_BUILD = '1.2.2-237'). Sin React ni DOM, para probarlo desde
// Node (scripts/test-actualizacion-logica.js).
// =====================================================
(function () {
  const MARCA = /<!--\s*odinote-build:\s*(\d+)\s*-->/i;

  // '1.2.2-237' → 237. Sin número, 0: así cualquier publicación con marca gana.
  function numeroBuild(build) {
    const m = String(build || '').match(/-(\d+)\s*$/);
    return m ? parseInt(m[1], 10) : 0;
  }
  function versionDe(build) {
    return String(build || '').split('-')[0].replace(/^v/i, '').trim();
  }
  function marcaBuild(notas) {
    const m = String(notas || '').match(MARCA);
    return m ? parseInt(m[1], 10) : 0;
  }
  // 1.2.10 > 1.2.9, y 1.0.8.1 > 1.0.8.
  function versionMayor(a, b) {
    const pa = String(a || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    const pb = String(b || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const x = pa[i] || 0, y = pb[i] || 0;
      if (x !== y) return x > y;
    }
    return false;
  }

  // ¿Esta publicación es más nueva que lo que tenemos?
  function hayNueva(buildLocal, publicacion) {
    if (!publicacion || publicacion.draft) return false;
    const remota = versionDe(publicacion.tag_name);
    const local = versionDe(buildLocal);
    if (!remota) return false;
    if (versionMayor(remota, local)) return true;
    if (versionMayor(local, remota)) return false;
    return marcaBuild(publicacion.body) > numeroBuild(buildLocal);
  }

  // El archivo que le toca a cada sistema. En Windows, el instalador
  // (Oddinote-Setup-….exe); si no hay, cualquier .exe. En Android, el APK.
  function archivoPara(publicacion, sistema) {
    const lista = (publicacion && Array.isArray(publicacion.assets)) ? publicacion.assets : [];
    const busca = (re) => lista.find(a => a && re.test(a.name || ''));
    const a = sistema === 'android' ? busca(/\.apk$/i)
      : sistema === 'linux' ? busca(/\.AppImage$/i)
      : (busca(/setup.*\.exe$/i) || busca(/\.exe$/i));
    if (!a) return null;
    const d = String(a.digest || '');
    return {
      url: a.browser_download_url,
      nombre: a.name,
      tamano: a.size || 0,
      // GitHub da la huella sha256 de cada archivo: con ella se comprueba que
      // lo descargado es exactamente lo publicado antes de instalarlo.
      sha256: /^sha256:[0-9a-f]{64}$/i.test(d) ? d.slice(7).toLowerCase() : null,
    };
  }

  // De la lista de publicaciones, la más reciente que no es borrador y trae
  // algo para este sistema.
  function eligePublicacion(publicaciones, sistema) {
    if (!Array.isArray(publicaciones)) return null;
    const vale = (r) => r && !r.draft && !r.prerelease && archivoPara(r, sistema);
    return publicaciones.find(vale) || null;
  }

  // Poner (o cambiar) la marca de build en unas notas: la usa
  // scripts/publica.js, para que ninguna publicación ni sustitución salga sin
  // ella (sin marca, una mini actualización de la misma versión no avisa).
  function ponMarca(notas, build) {
    const n = numeroBuild(build) || parseInt(build, 10) || 0;
    if (!n) throw new Error('build sin número: ' + build);
    const linea = `<!-- odinote-build: ${n} -->`;
    const t = String(notas || '');
    return MARCA.test(t) ? t.replace(MARCA, linea) : t.replace(/\s*$/, '') + '\n\n' + linea + '\n';
  }

  const api = { MARCA, numeroBuild, versionDe, marcaBuild, versionMayor, hayNueva, archivoPara, eligePublicacion, ponMarca };
  if (typeof window !== 'undefined') window.OdiActualiza = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
