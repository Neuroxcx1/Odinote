package io.github.neuroxcx1.oddinote;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketException;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Entrar con Google desde el teléfono, sin la ventana que Google bloquea.
 *
 * Google no deja iniciar sesión dentro del navegador incrustado de una app (el
 * WebView del APK): Firebase contestaba auth/internal-error. Lo que sí deja es
 * hacerlo en el navegador del propio teléfono. Así que se abre ahí la página de
 * Google y se le pide que, al terminar, vuelva a una dirección de este mismo
 * teléfono, 127.0.0.1, donde esta clase está escuchando: es el mismo flujo que
 * ya usa el escritorio (main.js), con las MISMAS credenciales de escritorio, y
 * por eso no hace falta crear ninguna nueva en la consola de Google.
 *
 * Lo protege PKCE, no el secreto de cliente (que en una app que se descarga no
 * es secreto, y Google lo sabe): cada intento firma con un número inventado en
 * el momento, y un código robado por el camino no le sirve a nadie sin él.
 *
 * No usa nada de Android a propósito: así se prueba en el ordenador con el JDK
 * (Movil/scripts/test-google-loopback.js), contra un Google de mentira.
 */
public final class GoogleLoopback {

    /** Abre la página de Google en el navegador. */
    public interface Abridor { void abre(String url) throws Exception; }

    /** Avisa de que el navegador ya volvió con el código (antes del canje). */
    public interface AlVolver { void vuelve(); }

    public static final class Tokens {
        public String accessToken;
        public String idToken;
        public String refreshToken;
        public long expiresIn;
    }

    /** Un fallo con su código, para que la app explique cuál fue. */
    public static final class Fallo extends Exception {
        public final String codigo;
        public Fallo(String codigo, String mensaje) { super(mensaje); this.codigo = codigo; }
    }

    private final String clientId;
    private final String clientSecret;
    private final String permisos;
    private final String vueltaApp;
    String urlAutorizacion = "https://accounts.google.com/o/oauth2/v2/auth";
    String urlTokens = "https://oauth2.googleapis.com/token";

    private volatile ServerSocket servidor;
    private volatile boolean cancelado;
    private volatile boolean codigoRecibido;

    /**
     * @param vueltaApp la dirección que devuelve al usuario a la app al acabar
     *                  (un intent:// que abre Oddinote); null para no ponerla.
     */
    public GoogleLoopback(String clientId, String clientSecret, String permisos, String vueltaApp) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.permisos = permisos;
        this.vueltaApp = vueltaApp;
    }

    /** ¿Llegó ya el navegador con el código? Después de eso no se cancela. */
    public boolean codigoRecibido() { return codigoRecibido; }

    /** Corta un intento en marcha: quien espera en entra() recibe "cancelado". */
    public void cancela() {
        cancelado = true;
        ServerSocket s = servidor;
        if (s != null) { try { s.close(); } catch (IOException ignorada) { } }
    }

    /**
     * Todo el inicio de sesión: escuchar, abrir Google, esperar la vuelta y
     * cambiar el código por los tokens. Bloquea: llamarlo fuera del hilo
     * principal.
     */
    public Tokens entra(Abridor abridor, long esperaMs, AlVolver alVolver) throws Fallo {
        String verificador = aleatorio(48);
        String estado = aleatorio(18);
        String reto;
        try {
            reto = base64url(MessageDigest.getInstance("SHA-256").digest(verificador.getBytes(StandardCharsets.US_ASCII)));
        } catch (Exception e) { throw new Fallo("interno", "Sin SHA-256: " + e.getMessage()); }

        String codigo;
        String redireccion;
        try (ServerSocket s = new ServerSocket(0, 4, InetAddress.getByName("127.0.0.1"))) {
            servidor = s;
            if (cancelado) throw new Fallo("cancelado", "Se canceló el inicio de sesión.");
            s.setSoTimeout((int) Math.min(Integer.MAX_VALUE, Math.max(1000, esperaMs)));
            redireccion = "http://127.0.0.1:" + s.getLocalPort() + "/oauth";

            Map<String, String> p = new LinkedHashMap<>();
            p.put("client_id", clientId);
            p.put("redirect_uri", redireccion);
            p.put("response_type", "code");
            p.put("scope", permisos);
            p.put("code_challenge", reto);
            p.put("code_challenge_method", "S256");
            p.put("state", estado);
            // Sin offline no hay token de refresco, y habría que volver a entrar
            // cada hora. Sin consent, Google solo lo da la primera vez.
            p.put("access_type", "offline");
            p.put("prompt", "consent");
            try {
                abridor.abre(urlAutorizacion + "?" + formulario(p));
            } catch (Exception e) {
                throw new Fallo("navegador", "No se pudo abrir el navegador: " + e.getMessage());
            }
            codigo = esperaCodigo(s, estado);
        } catch (Fallo f) {
            throw f;
        } catch (SocketTimeoutException e) {
            throw new Fallo("tiempo", "Google no volvió a tiempo.");
        } catch (SocketException e) {
            if (cancelado) throw new Fallo("cancelado", "Se canceló el inicio de sesión.");
            throw new Fallo("red", "Se cortó la escucha: " + e.getMessage());
        } catch (IOException e) {
            throw new Fallo("red", "No se pudo escuchar en este teléfono: " + e.getMessage());
        } finally {
            servidor = null;
        }
        if (alVolver != null) { try { alVolver.vuelve(); } catch (Exception ignorada) { } }

        Map<String, String> canje = new LinkedHashMap<>();
        canje.put("client_id", clientId);
        canje.put("client_secret", clientSecret);
        canje.put("code", codigo);
        canje.put("code_verifier", verificador);
        canje.put("grant_type", "authorization_code");
        canje.put("redirect_uri", redireccion);
        return pideTokens(canje);
    }

    /** Un permiso nuevo con el token de refresco guardado. */
    public Tokens renueva(String tokenRefresco) throws Fallo {
        Map<String, String> p = new LinkedHashMap<>();
        p.put("client_id", clientId);
        p.put("client_secret", clientSecret);
        p.put("refresh_token", tokenRefresco);
        p.put("grant_type", "refresh_token");
        return pideTokens(p);
    }

    // ── La vuelta del navegador ──
    //
    // Por la misma dirección llegan más cosas que la vuelta buena: el icono de
    // la pestaña (/favicon.ico), o una pestaña vieja de un intento anterior con
    // otro estado. Esas se contestan y se sigue esperando.
    private String esperaCodigo(ServerSocket s, String estado) throws IOException, Fallo {
        while (true) {
            try (Socket c = s.accept()) {
                c.setSoTimeout(10000);
                String linea = primeraLinea(c.getInputStream());
                String[] partes = linea.split(" ");
                String ruta = partes.length > 1 ? partes[1] : "";
                int q = ruta.indexOf('?');
                String camino = q >= 0 ? ruta.substring(0, q) : ruta;
                Map<String, String> datos = q >= 0 ? leeFormulario(ruta.substring(q + 1)) : new HashMap<>();
                if (!"/oauth".equals(camino)) {
                    responde(c.getOutputStream(), 404, "No es aquí.");
                    continue;
                }
                if (!estado.equals(datos.get("state"))) {
                    responde(c.getOutputStream(), 400, "Esta pestaña es de un intento anterior. Vuelve a Oddinote y pulsa otra vez «Entrar con Google».");
                    continue;
                }
                String error = datos.get("error");
                if (error != null) {
                    responde(c.getOutputStream(), 200, paginaFin(false));
                    throw new Fallo("google:" + error, "Google no dio permiso (" + error + ").");
                }
                String codigo = datos.get("code");
                if (codigo == null || codigo.isEmpty()) {
                    responde(c.getOutputStream(), 400, "Google volvió sin código.");
                    throw new Fallo("sin-codigo", "Google volvió sin código.");
                }
                codigoRecibido = true;
                responde(c.getOutputStream(), 200, paginaFin(true));
                return codigo;
            }
        }
    }

    private String paginaFin(boolean bien) {
        String vuelta = vueltaApp == null ? "" : vueltaApp.replace("\"", "%22");
        String titulo = bien ? "Listo: ya puedes volver a Oddinote" : "No se dio permiso";
        String texto = bien ? "La sesión se está terminando de abrir en la aplicación." : "Vuelve a Oddinote para intentarlo otra vez.";
        return "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
            + "<title>Oddinote</title><style>body{font-family:system-ui,sans-serif;background:#FAF7F2;color:#1A1A1A;display:flex;"
            + "flex-direction:column;align-items:center;justify-content:center;min-height:90vh;margin:0;padding:24px;text-align:center}"
            + "a{display:inline-block;margin-top:18px;padding:12px 22px;border:2px solid #1A1A1A;border-radius:10px;background:#90B968;"
            + "color:#1A1A1A;font-weight:700;text-decoration:none;box-shadow:3px 3px 0 #1A1A1A}</style></head><body>"
            + "<h2>" + titulo + "</h2><p>" + texto + "</p>"
            + (vuelta.isEmpty() ? "" : "<a href=\"" + vuelta + "\">Volver a Oddinote</a><script>setTimeout(function(){location.href=\"" + vuelta + "\"},300)</script>")
            + "</body></html>";
    }

    // ── Hablar con Google ──
    private Tokens pideTokens(Map<String, String> cuerpo) throws Fallo {
        HttpURLConnection con = null;
        try {
            byte[] datos = formulario(cuerpo).getBytes(StandardCharsets.UTF_8);
            con = (HttpURLConnection) new URL(urlTokens).openConnection();
            con.setRequestMethod("POST");
            con.setConnectTimeout(20000);
            con.setReadTimeout(20000);
            con.setDoOutput(true);
            con.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
            try (OutputStream o = con.getOutputStream()) { o.write(datos); }
            int estado = con.getResponseCode();
            InputStream in = estado >= 400 ? con.getErrorStream() : con.getInputStream();
            String texto = in == null ? "" : new String(leeTodo(in), StandardCharsets.UTF_8);
            Map<String, String> j = leeJsonPlano(texto);
            if (estado >= 400 || j.get("access_token") == null) {
                String err = j.get("error") != null ? j.get("error") : ("HTTP " + estado);
                String desc = j.get("error_description");
                throw new Fallo(err, desc != null ? desc : err);
            }
            Tokens t = new Tokens();
            t.accessToken = j.get("access_token");
            t.idToken = j.get("id_token");
            t.refreshToken = j.get("refresh_token");
            try { t.expiresIn = Long.parseLong(j.getOrDefault("expires_in", "3600")); } catch (NumberFormatException e) { t.expiresIn = 3600; }
            return t;
        } catch (Fallo f) {
            throw f;
        } catch (IOException e) {
            throw new Fallo("red", "Sin conexión con Google: " + e.getMessage());
        } finally {
            if (con != null) con.disconnect();
        }
    }

    // ── Pequeñas ayudas (sin bibliotecas: esto también corre fuera de Android) ──

    static String aleatorio(int bytes) {
        byte[] b = new byte[bytes];
        new SecureRandom().nextBytes(b);
        return base64url(b);
    }

    static String base64url(byte[] b) {
        final String A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
        StringBuilder s = new StringBuilder();
        int i = 0;
        for (; i + 2 < b.length; i += 3) {
            int n = ((b[i] & 0xff) << 16) | ((b[i + 1] & 0xff) << 8) | (b[i + 2] & 0xff);
            s.append(A.charAt((n >> 18) & 63)).append(A.charAt((n >> 12) & 63)).append(A.charAt((n >> 6) & 63)).append(A.charAt(n & 63));
        }
        int resto = b.length - i;
        if (resto == 1) {
            int n = (b[i] & 0xff) << 16;
            s.append(A.charAt((n >> 18) & 63)).append(A.charAt((n >> 12) & 63));
        } else if (resto == 2) {
            int n = ((b[i] & 0xff) << 16) | ((b[i + 1] & 0xff) << 8);
            s.append(A.charAt((n >> 18) & 63)).append(A.charAt((n >> 12) & 63)).append(A.charAt((n >> 6) & 63));
        }
        return s.toString();
    }

    static String formulario(Map<String, String> p) {
        StringBuilder s = new StringBuilder();
        try {
            for (Map.Entry<String, String> e : p.entrySet()) {
                if (s.length() > 0) s.append('&');
                s.append(URLEncoder.encode(e.getKey(), "UTF-8")).append('=').append(URLEncoder.encode(e.getValue() == null ? "" : e.getValue(), "UTF-8"));
            }
        } catch (java.io.UnsupportedEncodingException imposible) { throw new IllegalStateException(imposible); }
        return s.toString();
    }

    static Map<String, String> leeFormulario(String q) {
        Map<String, String> m = new HashMap<>();
        for (String par : q.split("&")) {
            if (par.isEmpty()) continue;
            int i = par.indexOf('=');
            try {
                String k = URLDecoder.decode(i >= 0 ? par.substring(0, i) : par, "UTF-8");
                String v = i >= 0 ? URLDecoder.decode(par.substring(i + 1), "UTF-8") : "";
                m.put(k, v);
            } catch (Exception ignorada) { }
        }
        return m;
    }

    private static String primeraLinea(InputStream in) throws IOException {
        StringBuilder s = new StringBuilder();
        int c;
        while ((c = in.read()) != -1 && c != '\n') {
            if (c != '\r') s.append((char) c);
            if (s.length() > 8192) break;
        }
        return s.toString();
    }

    private static void responde(OutputStream o, int estado, String cuerpo) throws IOException {
        byte[] b = cuerpo.getBytes(StandardCharsets.UTF_8);
        String razon = estado == 200 ? "OK" : estado == 404 ? "Not Found" : "Bad Request";
        String cab = "HTTP/1.1 " + estado + " " + razon + "\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: " + b.length
            + "\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n";
        o.write(cab.getBytes(StandardCharsets.US_ASCII));
        o.write(b);
        o.flush();
    }

    private static byte[] leeTodo(InputStream in) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int n;
        while ((n = in.read(buf)) != -1) b.write(buf, 0, n);
        return b.toByteArray();
    }

    /** Un JSON de un solo nivel (lo que devuelve /token): cada clave con su valor como texto. */
    static Map<String, String> leeJsonPlano(String s) {
        Map<String, String> m = new HashMap<>();
        int i = s.indexOf('{');
        if (i < 0) return m;
        i++;
        while (i < s.length()) {
            while (i < s.length() && (Character.isWhitespace(s.charAt(i)) || s.charAt(i) == ',')) i++;
            if (i >= s.length() || s.charAt(i) == '}') break;
            if (s.charAt(i) != '"') break;
            StringBuilder k = new StringBuilder();
            i = leeCadena(s, i, k);
            while (i < s.length() && (Character.isWhitespace(s.charAt(i)) || s.charAt(i) == ':')) i++;
            if (i >= s.length()) break;
            if (s.charAt(i) == '"') {
                StringBuilder v = new StringBuilder();
                i = leeCadena(s, i, v);
                m.put(k.toString(), v.toString());
            } else {
                int j = i;
                int hondo = 0;
                while (j < s.length()) {
                    char c = s.charAt(j);
                    // Una cadena dentro de un objeto anidado puede llevar } o , sin
                    // que cuenten: se salta entera.
                    if (c == '"') { j = leeCadena(s, j, new StringBuilder()); continue; }
                    if (c == '{' || c == '[') hondo++;
                    else if (c == '}' || c == ']') { if (hondo == 0) break; hondo--; }
                    else if (c == ',' && hondo == 0) break;
                    j++;
                }
                m.put(k.toString(), s.substring(i, j).trim());
                i = j;
            }
        }
        return m;
    }

    private static int leeCadena(String s, int i, StringBuilder out) {
        i++;
        while (i < s.length()) {
            char c = s.charAt(i);
            if (c == '"') return i + 1;
            if (c == '\\' && i + 1 < s.length()) {
                char e = s.charAt(++i);
                switch (e) {
                    case 'n': out.append('\n'); break;
                    case 't': out.append('\t'); break;
                    case 'r': out.append('\r'); break;
                    case 'b': out.append('\b'); break;
                    case 'f': out.append('\f'); break;
                    case 'u':
                        if (i + 4 < s.length()) { out.append((char) Integer.parseInt(s.substring(i + 1, i + 5), 16)); i += 4; }
                        break;
                    default: out.append(e);
                }
            } else out.append(c);
            i++;
        }
        return i;
    }
}
