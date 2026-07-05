// =====================================================
// Odinote — utilidades de Google Drive (window.OdiDrive)
// Módulo sin dependencias de React, testeable en Node
// (se inyectan fetch/log), usado por app.jsx.
// =====================================================
(function () {
  const DRIVE_API = 'https://www.googleapis.com/drive/v3';
  const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

  // Un src que no es http(s) es un medio local pendiente de subir:
  // data:, media/..., /vault-media/... o rutas absolutas antiguas (file:///...)
  function isLocalSrc(src) {
    return !!src && !src.startsWith('http://') && !src.startsWith('https://');
  }

  // URLs 'uc?export=view' de subidas antiguas: Google ya no las sirve como <img>.
  // Se convierten al endpoint lh3 sin volver a subir nada.
  function legacyDriveImageUrl(node) {
    if (!node || node.type !== 'image') return null;
    const m = (node.src || '').match(/^https:\/\/drive\.google\.com\/uc\?export=view&id=([\w-]{20,})$/);
    return m ? `https://lh3.googleusercontent.com/d/${m[1]}` : null;
  }

  // Recolecta los canvases del proyecto (raíz + boards anidados via canvasId)
  function collectProjectCanvases(allCanvases, rootId) {
    const out = {};
    const visit = (id) => {
      const c = allCanvases[id];
      if (!c || out[id]) return;
      out[id] = c;
      (c.items || []).forEach(it => { if (it.canvasId) visit(it.canvasId); });
    };
    visit(rootId);
    return out;
  }

  // data:<mime>;base64,XXX → { mime, bytes: Uint8Array }
  function dataUrlToBytes(dataUrl) {
    const parts = (dataUrl || '').split(',');
    if (parts.length < 2) return null;
    const mimeMatch = parts[0].match(/:(.*?);/);
    if (!mimeMatch) return null;
    let binStr;
    try { binStr = atob(parts[1]); } catch (e) { return null; }
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
    return { mime: mimeMatch[1], bytes };
  }

  function extForMime(mime) {
    const map = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
      'image/svg+xml': 'svg', 'image/bmp': 'bmp', 'audio/mpeg': 'mp3', 'audio/wav': 'wav',
      'audio/ogg': 'ogg', 'audio/webm': 'weba', 'video/mp4': 'mp4', 'video/webm': 'webm',
      'application/pdf': 'pdf'
    };
    return map[mime] || (mime.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '') || 'bin';
  }

  // URL pública usable directamente como src en <img>/<audio>
  function publicUrlForFile(fileId, mime) {
    if (mime && mime.startsWith('image/')) return `https://lh3.googleusercontent.com/d/${fileId}`;
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }

  // Busca o crea una subcarpeta dentro de la carpeta indicada. Devuelve
  // { id } · { authError } · { id: null } si no se pudo crear.
  async function ensureSubfolder({ parentId, name, accessToken, fetchFn }) {
    const f = fetchFn || fetch.bind(typeof window !== 'undefined' ? window : globalThis);
    const authHeaders = { 'Authorization': `Bearer ${accessToken}` };
    const q = encodeURIComponent(`name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const res = await f(`${DRIVE_API}/files?q=${q}&fields=files(id)`, { headers: authHeaders });
    if (res.status === 401 || res.status === 403) return { authError: res.status };
    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) return { id: data.files[0].id };
    }
    const createRes = await f(`${DRIVE_API}/files`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] })
    });
    if (createRes.status === 401 || createRes.status === 403) return { authError: createRes.status };
    if (!createRes.ok) return { id: null };
    const created = await createRes.json();
    return { id: created.id || null };
  }

  // Sube (o actualiza, si ya existe uno con el mismo nombre) un archivo binario
  // en la carpeta indicada usando subida REANUDABLE: el método multipart anterior
  // tenía un límite de 5 MB y fallaba en silencio con imágenes grandes.
  // Devuelve { fileId, url } · { authError: 401|403 } · null si falló.
  async function uploadMediaFile({ folderId, baseName, media, accessToken, fetchFn, log }) {
    const f = fetchFn || fetch.bind(typeof window !== 'undefined' ? window : globalThis);
    const L = log || function () {};
    if (!media || !media.bytes || !media.bytes.length) { L(`${baseName}: sin bytes que subir`); return null; }
    const { mime, bytes } = media;
    const fileName = `${baseName}.${extForMime(mime)}`;
    const authHeaders = { 'Authorization': `Bearer ${accessToken}` };

    // 1. ¿Ya existe? → actualizar en vez de duplicar
    let existingId = null;
    const q = encodeURIComponent(`name='${fileName}' and '${folderId}' in parents and trashed=false`);
    const searchRes = await f(`${DRIVE_API}/files?q=${q}&fields=files(id)`, { headers: authHeaders });
    if (searchRes.status === 401 || searchRes.status === 403) return { authError: searchRes.status };
    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) existingId = data.files[0].id;
    }

    // 2. Iniciar la sesión de subida reanudable
    const initUrl = existingId
      ? `${DRIVE_UPLOAD}/files/${existingId}?uploadType=resumable`
      : `${DRIVE_UPLOAD}/files?uploadType=resumable`;
    const initRes = await f(initUrl, {
      method: existingId ? 'PATCH' : 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mime,
        'X-Upload-Content-Length': String(bytes.length)
      },
      body: JSON.stringify(existingId ? {} : { name: fileName, parents: [folderId] })
    });
    if (initRes.status === 401 || initRes.status === 403) return { authError: initRes.status };
    if (!initRes.ok) { L(`${fileName}: init de subida falló (HTTP ${initRes.status})`); return null; }
    const sessionUrl = initRes.headers && initRes.headers.get && initRes.headers.get('Location');
    if (!sessionUrl) { L(`${fileName}: Drive no devolvió URL de sesión`); return null; }

    // 3. Subir los bytes
    const putRes = await f(sessionUrl, { method: 'PUT', headers: { 'Content-Type': mime }, body: bytes });
    if (!putRes.ok) { L(`${fileName}: subida de bytes falló (HTTP ${putRes.status})`); return null; }
    const fileData = await putRes.json();
    if (!fileData || !fileData.id) { L(`${fileName}: respuesta sin id de archivo`); return null; }

    // 4. Permiso público de lectura para que el resto de dispositivos lo vean.
    // Si falla, la imagen dará 404 en los demás dispositivos: hay que saberlo.
    try {
      const permRes = await f(`${DRIVE_API}/files/${fileData.id}/permissions`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'reader', type: 'anyone' })
      });
      if (!permRes.ok) {
        L(`${fileName}: AVISO — el permiso público falló (HTTP ${permRes.status}); la imagen puede no verse en otros dispositivos`);
      }
    } catch (e) {
      L(`${fileName}: AVISO — error de red al establecer el permiso público`);
    }

    return { fileId: fileData.id, url: publicUrlForFile(fileData.id, mime) };
  }

  // Escanea TODAS las páginas del proyecto (raíz + boards anidados + hijos de
  // columnas), sube cada medio local a Drive y devuelve el mapa de reemplazos.
  // Devuelve { replaced: {canvasId: {clave: url}}, attempted, uploaded, authError }
  async function syncProjectMedia({ canvases, projectId, folderId, accessToken, resolveSrc, fetchFn, log }) {
    const f = fetchFn || fetch.bind(typeof window !== 'undefined' ? window : globalThis);
    const L = log || function () {};
    const replaced = {};
    let attempted = 0, uploaded = 0, authError = null;

    if (!folderId) { L('Sin carpeta de proyecto en Drive: se pospone la subida de medios'); return { replaced, attempted, uploaded, authError }; }

    // Los medios van en la subcarpeta "media" del proyecto, no sueltos en la raíz
    const sub = await ensureSubfolder({ parentId: folderId, name: 'media', accessToken, fetchFn: f });
    if (sub.authError) return { replaced, attempted, uploaded, authError: sub.authError };
    const mediaFolderId = sub.id || folderId;
    L(sub.id ? 'Carpeta de medios: media/' : 'No se pudo crear la carpeta media/: se usará la raíz del proyecto');

    // Lee un medio local como bytes: data-URL directo, o rutas del Vault via HTTP local
    const readLocalMedia = async (src) => {
      if (src.startsWith('data:')) return dataUrlToBytes(src);
      try {
        const resp = await f(resolveSrc ? resolveSrc(src) : src);
        if (!resp.ok) return null;
        const ab = await resp.arrayBuffer();
        const rawMime = (resp.headers && resp.headers.get && resp.headers.get('content-type')) || 'application/octet-stream';
        return { mime: rawMime.split(';')[0], bytes: new Uint8Array(ab) };
      } catch (e) { return null; }
    };

    const processOne = async (cid, key, node) => {
      const legacy = legacyDriveImageUrl(node);
      if (legacy) {
        (replaced[cid] = replaced[cid] || {})[key] = legacy;
        return;
      }
      if (!isLocalSrc(node.src)) return;
      attempted++;
      const media = await readLocalMedia(node.src);
      L(`${key} (${node.type || '?'}): lectura ${media ? `OK ${media.mime}, ${media.bytes.length} bytes` : 'FALLÓ'} · src: ${(node.src || '').slice(0, 60)}`);
      if (!media) return;
      const res = await uploadMediaFile({ folderId: mediaFolderId, baseName: `media_${node.id}`, media, accessToken, fetchFn: f, log: L });
      if (res && res.authError) { authError = res.authError; return; }
      if (res && res.url) {
        uploaded++;
        (replaced[cid] = replaced[cid] || {})[key] = res.url;
        L(`${key}: subido -> ${res.url}`);
      } else {
        L(`${key}: subida FALLÓ`);
      }
    };

    const pages = collectProjectCanvases(canvases, projectId);
    L(`Escaneo de medios: ${Object.keys(pages).length} páginas del proyecto ${projectId}`);
    for (const cid of Object.keys(pages)) {
      for (const item of (pages[cid].items || [])) {
        await processOne(cid, item.id, item);
        if (authError) return { replaced, attempted, uploaded, authError };
        for (const child of (item.children || [])) {
          await processOne(cid, `${item.id}::${child.id}`, child);
          if (authError) return { replaced, attempted, uploaded, authError };
        }
      }
    }
    L(`Escaneo terminado: ${attempted} medios locales, ${uploaded} subidos`);
    return { replaced, attempted, uploaded, authError };
  }

  const OdiDrive = { isLocalSrc, legacyDriveImageUrl, collectProjectCanvases, dataUrlToBytes, extForMime, publicUrlForFile, ensureSubfolder, uploadMediaFile, syncProjectMedia };
  if (typeof window !== 'undefined') window.OdiDrive = OdiDrive;
  if (typeof module !== 'undefined' && module.exports) module.exports = OdiDrive;
})();
