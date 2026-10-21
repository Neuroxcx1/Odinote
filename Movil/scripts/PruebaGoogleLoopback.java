package io.github.neuroxcx1.oddinote;

import com.sun.net.httpserver.HttpServer;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.Random;

/**
 * GoogleLoopback contra un Google de mentira, en el ordenador: la página de
 * autorización la «abre» la prueba, la vuelta al 127.0.0.1 la hace la prueba
 * como la haría el navegador del teléfono, y el canje de tokens lo contesta un
 * servidor local que comprueba lo mismo que comprueba Google (PKCE incluido).
 *
 *   node Movil/scripts/test-google-loopback.js
 */
public class PruebaGoogleLoopback {
    static int fallos = 0;
    static void ok(boolean c, String que, Object detalle) {
        System.out.println((c ? "OK    " : "FALLA ") + que + (detalle == null ? "" : " — " + detalle));
        if (!c) fallos++;
    }

    static final Map<String, String> pedidoAuth = new HashMap<>();
    static volatile String ultimoCanje = "";

    public static void main(String[] args) throws Exception {
        HttpServer google = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        google.createContext("/token", (ex) -> {
            String cuerpo = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            ultimoCanje = cuerpo;
            Map<String, String> f = GoogleLoopback.leeFormulario(cuerpo);
            int estado = 200;
            String resp;
            if ("authorization_code".equals(f.get("grant_type"))) {
                boolean bien = "codigo-bueno".equals(f.get("code")) && "secreto".equals(f.get("client_secret"))
                    && "cliente".equals(f.get("client_id")) && f.get("redirect_uri") != null
                    && f.get("redirect_uri").equals(pedidoAuth.get("redirect_uri"))
                    && retoDe(f.get("code_verifier")).equals(pedidoAuth.get("code_challenge"));
                if (bien) resp = "{\"access_token\": \"ya29.a\\\"b\\u00e9\", \"expires_in\": 3599, \"refresh_token\": \"1//r\", \"scope\": \"openid x\", \"id_token\": \"e.y.j\", \"token_type\": \"Bearer\", \"extra\": {\"a\": [1, 2]}}";
                else { estado = 400; resp = "{\"error\": \"invalid_grant\", \"error_description\": \"Bad Request\"}"; }
            } else if ("refresh_token".equals(f.get("grant_type"))) {
                if ("1//r".equals(f.get("refresh_token"))) resp = "{\"access_token\":\"nuevo\",\"expires_in\":3600,\"id_token\":\"id2\"}";
                else { estado = 400; resp = "{\"error\":\"invalid_grant\",\"error_description\":\"Token has been expired or revoked.\"}"; }
            } else { estado = 400; resp = "{\"error\":\"unsupported_grant_type\"}"; }
            byte[] b = resp.getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().add("Content-Type", "application/json");
            ex.sendResponseHeaders(estado, b.length);
            try (OutputStream o = ex.getResponseBody()) { o.write(b); }
        });
        google.start();
        String urlTokens = "http://127.0.0.1:" + google.getAddress().getPort() + "/token";

        // ── 1. El camino bueno, con las visitas que no son la vuelta ──
        {
            GoogleLoopback g = nuevo(urlTokens);
            final String[] respuestas = new String[3];
            final boolean[] volvio = { false };
            GoogleLoopback.Tokens t = g.entra((url) -> {
                apunta(url);
                String vuelta = pedidoAuth.get("redirect_uri");
                new Thread(() -> {
                    try {
                        respuestas[0] = pide(vuelta.replace("/oauth", "/favicon.ico"));
                        respuestas[1] = pide(vuelta + "?code=otro&state=de-otro-intento");
                        respuestas[2] = pide(vuelta + "?code=codigo-bueno&state=" + pedidoAuth.get("state") + "&scope=openid");
                    } catch (Exception e) { e.printStackTrace(); }
                }).start();
            }, 10000, () -> volvio[0] = true);
            ok(pedidoAuth.get("redirect_uri").matches("http://127\\.0\\.0\\.1:\\d+/oauth"), "la vuelta es a 127.0.0.1 con un puerto libre", pedidoAuth.get("redirect_uri"));
            ok("code".equals(pedidoAuth.get("response_type")) && "S256".equals(pedidoAuth.get("code_challenge_method")), "pide un código con PKCE (S256)", null);
            ok("offline".equals(pedidoAuth.get("access_type")) && "consent".equals(pedidoAuth.get("prompt")), "pide token de refresco (offline + consent)", null);
            ok(pedidoAuth.get("scope").contains("openid") && pedidoAuth.get("scope").contains("drive.file"), "con los permisos del escritorio", pedidoAuth.get("scope"));
            ok(pedidoAuth.get("state").length() >= 20, "y un estado inventado", null);
            ok(respuestas[0] != null && respuestas[0].startsWith("404"), "el icono de la pestaña se contesta y se sigue esperando", respuestas[0]);
            ok(respuestas[1] != null && respuestas[1].startsWith("400"), "una pestaña de otro intento no vale", respuestas[1] == null ? null : respuestas[1].substring(0, 3));
            ok(respuestas[2] != null && respuestas[2].startsWith("200") && respuestas[2].contains("Volver a Oddinote") && respuestas[2].contains("intent://login"), "la vuelta buena enseña el botón de volver a la app", null);
            ok(volvio[0], "y avisa de que volvió antes del canje", null);
            ok("ya29.a\"bé".equals(t.accessToken), "el permiso de Drive llega entero (con comillas y acentos escapados)", t.accessToken);
            ok("1//r".equals(t.refreshToken) && "e.y.j".equals(t.idToken) && t.expiresIn == 3599, "con el refresco, el carnet y la duración", t.refreshToken + " " + t.idToken + " " + t.expiresIn);
            ok(g.codigoRecibido(), "y se apunta que el código llegó (ya no se cancela al volver)", null);
            ok(ultimoCanje.contains("client_secret=secreto") && ultimoCanje.contains("code_verifier="), "el canje lleva el secreto y el verificador", null);
        }

        // ── 2. Google dice que no ──
        {
            GoogleLoopback g = nuevo(urlTokens);
            String codigo = null;
            try {
                g.entra((url) -> { apunta(url); new Thread(() -> { try { pide(pedidoAuth.get("redirect_uri") + "?error=access_denied&state=" + pedidoAuth.get("state")); } catch (Exception e) { } }).start(); }, 10000, null);
            } catch (GoogleLoopback.Fallo f) { codigo = f.codigo; }
            ok("google:access_denied".equals(codigo), "si no se da permiso, el error dice cuál", codigo);
        }

        // ── 3. Se cancela (volvió a la app sin terminar) ──
        {
            GoogleLoopback g = nuevo(urlTokens);
            String codigo = null;
            long t0 = System.currentTimeMillis();
            new Thread(() -> { try { Thread.sleep(300); } catch (Exception e) { } g.cancela(); }).start();
            try { g.entra((url) -> apunta(url), 60000, null); } catch (GoogleLoopback.Fallo f) { codigo = f.codigo; }
            ok("cancelado".equals(codigo) && System.currentTimeMillis() - t0 < 5000, "cancelar corta la espera al momento", codigo + " en " + (System.currentTimeMillis() - t0) + " ms");
            ok(!g.codigoRecibido(), "sin código recibido", null);
        }

        // ── 4. Nadie vuelve ──
        {
            GoogleLoopback g = nuevo(urlTokens);
            String codigo = null;
            try { g.entra((url) -> apunta(url), 1200, null); } catch (GoogleLoopback.Fallo f) { codigo = f.codigo; }
            ok("tiempo".equals(codigo), "si Google no vuelve, se rinde con «tiempo»", codigo);
        }

        // ── 5. El navegador no se abre ──
        {
            GoogleLoopback g = nuevo(urlTokens);
            String codigo = null;
            try { g.entra((url) -> { throw new Exception("no hay navegador"); }, 5000, null); } catch (GoogleLoopback.Fallo f) { codigo = f.codigo; }
            ok("navegador".equals(codigo), "sin navegador, lo dice", codigo);
        }

        // ── 6. Un código que Google no acepta ──
        {
            GoogleLoopback g = nuevo(urlTokens);
            String codigo = null;
            try {
                g.entra((url) -> { apunta(url); new Thread(() -> { try { pide(pedidoAuth.get("redirect_uri") + "?code=caducado&state=" + pedidoAuth.get("state")); } catch (Exception e) { } }).start(); }, 10000, null);
            } catch (GoogleLoopback.Fallo f) { codigo = f.codigo; }
            ok("invalid_grant".equals(codigo), "un código que no vale da invalid_grant", codigo);
        }

        // ── 7. Renovar ──
        {
            GoogleLoopback g = nuevo(urlTokens);
            GoogleLoopback.Tokens t = g.renueva("1//r");
            ok("nuevo".equals(t.accessToken) && "id2".equals(t.idToken), "renovar con el refresco da permiso y carnet nuevos", t.accessToken);
            String codigo = null;
            try { g.renueva("revocado"); } catch (GoogleLoopback.Fallo f) { codigo = f.codigo; }
            ok("invalid_grant".equals(codigo), "un refresco revocado da invalid_grant (y la app lo tira)", codigo);
            GoogleLoopback sinRed = nuevo("http://127.0.0.1:1/token");
            codigo = null;
            try { sinRed.renueva("1//r"); } catch (GoogleLoopback.Fallo f) { codigo = f.codigo; }
            ok("red".equals(codigo), "sin conexión es «red», no invalid_grant (el refresco no se tira)", codigo);

            // El canje reintenta mientras el fallo es de red: aquí el «Google»
            // no existe durante el primer segundo y luego sí.
            {
                java.util.Map<String, String> cuerpo = new java.util.LinkedHashMap<>();
                cuerpo.put("grant_type", "refresh_token");
                cuerpo.put("refresh_token", "1//r");
                GoogleLoopback tarde = nuevo("http://127.0.0.1:" + puertoLibre() + "/token");
                long t0 = System.currentTimeMillis();
                String cod = null;
                try { tarde.pideTokensConReintentos(cuerpo, 1500); } catch (GoogleLoopback.Fallo f) { cod = f.codigo; }
                ok("red".equals(cod) && System.currentTimeMillis() - t0 >= 900, "sin Google, reintenta hasta el plazo y acaba en «red»", cod + " en " + (System.currentTimeMillis() - t0) + " ms");
                GoogleLoopback bueno = nuevo(urlTokens);
                GoogleLoopback.Tokens tk = null;
                try { tk = bueno.pideTokensConReintentos(cuerpo, 1500); } catch (GoogleLoopback.Fallo f) { cod = f.codigo; }
                ok(tk != null && tk.accessToken != null, "con Google, el canje con reintentos entra a la primera", null);
            }
        }

        // ── 8. Las ayudas ──
        {
            Random r = new Random(7);
            boolean iguales = true;
            for (int n = 0; n < 60 && iguales; n++) {
                byte[] b = new byte[n];
                r.nextBytes(b);
                iguales = Base64.getUrlEncoder().withoutPadding().encodeToString(b).equals(GoogleLoopback.base64url(b));
            }
            ok(iguales, "base64url coincide con el del JDK de 0 a 59 bytes", null);
            Map<String, String> j = GoogleLoopback.leeJsonPlano("{ \"a\" : \"x\\\\y\\/z\", \"n\": -12.5, \"o\": {\"p\": \"q,}\"}, \"b\": true }");
            ok("x\\y/z".equals(j.get("a")) && "-12.5".equals(j.get("n")) && "true".equals(j.get("b")), "el JSON plano lee cadenas, números y saltos", j.toString());
        }

        google.stop(0);
        System.out.println(fallos == 0 ? "\nTodo bien." : "\n" + fallos + " fallo(s).");
        System.exit(fallos == 0 ? 0 : 1);
    }

    static GoogleLoopback nuevo(String urlTokens) {
        GoogleLoopback g = new GoogleLoopback("cliente", "secreto", "openid https://www.googleapis.com/auth/drive.file", "intent://login#Intent;scheme=oddinote;package=io.github.neuroxcx1.oddinote;end");
        g.urlAutorizacion = "https://accounts.google.com/o/oauth2/v2/auth";
        g.urlTokens = urlTokens;
        return g;
    }

    static void apunta(String url) {
        pedidoAuth.clear();
        pedidoAuth.putAll(GoogleLoopback.leeFormulario(URI.create(url).getRawQuery()));
    }

    static String retoDe(String verificador) {
        try {
            return Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(verificador.getBytes(StandardCharsets.US_ASCII)));
        } catch (Exception e) { return "?"; }
    }

    // Como el navegador: pide la dirección y devuelve "código cuerpo".
    static String pide(String direccion) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(direccion).openConnection();
        c.setInstanceFollowRedirects(false);
        int estado = c.getResponseCode();
        InputStream in = estado >= 400 ? c.getErrorStream() : c.getInputStream();
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        if (in != null) in.transferTo(b);
        return estado + " " + b.toString(StandardCharsets.UTF_8);
    }

    // Un puerto donde no escucha nadie: se abre y se cierra.
    static int puertoLibre() throws java.io.IOException {
        try (java.net.ServerSocket s = new java.net.ServerSocket(0, 1, java.net.InetAddress.getByName("127.0.0.1"))) { return s.getLocalPort(); }
    }
}
