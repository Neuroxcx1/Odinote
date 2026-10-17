package io.github.neuroxcx1.oddinote;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * El puente entre la app (window.odiGoogleMovil, en App/src/google-movil.js) y
 * GoogleLoopback, que hace el inicio de sesión de verdad.
 *
 * El token de refresco se guarda en este teléfono, CIFRADO con una llave del
 * almacén de Android (que no sale nunca del teléfono): es lo que deja renovar el
 * permiso de Drive cada hora sin volver a pedir la cuenta. En el escritorio se
 * hace lo mismo con safeStorage.
 */
@CapacitorPlugin(name = "EntrarConGoogle")
public class EntrarConGoogle extends Plugin {

    private static final String ETIQUETA = "OddinoteGoogle";
    // Los mismos permisos que pide el escritorio (main.js, GOOGLE_SCOPES).
    private static final String PERMISOS = "openid https://www.googleapis.com/auth/drive.file "
        + "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile";
    private static final String PREFERENCIAS = "odinote-google";
    private static final String CLAVE_REFRESCO = "refresco";
    private static final String LLAVE = "odinote-google-refresco";
    // Un intent:// y no oddinote://: así el navegador sabe a qué app va aunque
    // no conozca el esquema, y no ofrece buscarla en la tienda.
    private static final String VUELTA = "intent://login#Intent;scheme=oddinote;package=" + BuildConfig.APPLICATION_ID + ";end";

    private GoogleLoopback enCurso;
    private PluginCall llamadaEnCurso;

    private GoogleLoopback nuevoFlujo() {
        return new GoogleLoopback(BuildConfig.GOOGLE_CLIENT_ID, BuildConfig.GOOGLE_CLIENT_SECRET, PERMISOS, VUELTA);
    }

    private boolean hayCredenciales() {
        return !BuildConfig.GOOGLE_CLIENT_ID.isEmpty() && !BuildConfig.GOOGLE_CLIENT_SECRET.isEmpty();
    }

    @PluginMethod
    public void entrar(PluginCall call) {
        if (!hayCredenciales()) {
            call.reject("Este APK se compiló sin las credenciales de Google (App/google-oauth.json).", "sin-credenciales");
            return;
        }
        // Un segundo toque mientras se espera: el intento viejo se abandona.
        synchronized (this) {
            if (enCurso != null) {
                enCurso.cancela();
                if (llamadaEnCurso != null) llamadaEnCurso.reject("Se empezó otro inicio de sesión.", "cancelado");
            }
            enCurso = nuevoFlujo();
            llamadaEnCurso = call;
        }
        final GoogleLoopback flujo = enCurso;
        new Thread(() -> {
            try {
                GoogleLoopback.Tokens t = flujo.entra(this::abreNavegador, 10 * 60 * 1000L, this::traeAlFrente);
                if (t.refreshToken != null) guardaRefresco(t.refreshToken);
                JSObject r = new JSObject();
                r.put("accessToken", t.accessToken);
                r.put("idToken", t.idToken);
                r.put("expiresIn", t.expiresIn);
                r.put("conRefresco", t.refreshToken != null);
                call.resolve(r);
            } catch (GoogleLoopback.Fallo f) {
                Log.w(ETIQUETA, "No se pudo entrar: " + f.codigo + " " + f.getMessage());
                call.reject(f.getMessage(), f.codigo);
            } finally {
                synchronized (this) {
                    if (enCurso == flujo) { enCurso = null; llamadaEnCurso = null; }
                }
            }
        }, "oddinote-google").start();
    }

    @PluginMethod
    public void renovar(PluginCall call) {
        if (!hayCredenciales()) { call.reject("Sin credenciales.", "sin-credenciales"); return; }
        final String refresco = leeRefresco();
        if (refresco == null) { call.reject("No hay sesión guardada en este teléfono.", "sin-refresco"); return; }
        new Thread(() -> {
            try {
                GoogleLoopback.Tokens t = nuevoFlujo().renueva(refresco);
                JSObject r = new JSObject();
                r.put("accessToken", t.accessToken);
                r.put("idToken", t.idToken);
                r.put("expiresIn", t.expiresIn);
                call.resolve(r);
            } catch (GoogleLoopback.Fallo f) {
                // Revocado, contraseña cambiada o caducado: el papel ya no vale y
                // se tira, como en el escritorio. Un fallo de red no lo toca.
                if (f.codigo.equals("invalid_grant")) borraRefresco();
                call.reject(f.getMessage(), f.codigo);
            }
        }, "oddinote-google-renueva").start();
    }

    @PluginMethod
    public void hayRefresco(PluginCall call) {
        JSObject r = new JSObject();
        r.put("ok", leeRefresco() != null);
        call.resolve(r);
    }

    @PluginMethod
    public void salir(PluginCall call) {
        borraRefresco();
        call.resolve();
    }

    // Si vuelve a la app sin haber terminado en el navegador (cerró la pestaña,
    // pulsó atrás), el intento se da por cancelado: si no, el botón se quedaría
    // «esperando a Google» para siempre. Se espera un poco porque al acabar bien
    // también se vuelve a la app, y el código puede estar llegando justo entonces.
    @Override
    protected void handleOnResume() {
        final GoogleLoopback flujo;
        synchronized (this) { flujo = enCurso; }
        if (flujo == null) return;
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            synchronized (this) {
                if (enCurso == flujo && !flujo.codigoRecibido()) flujo.cancela();
            }
        }, 2500);
    }

    // Se abre desde el hilo principal, que es donde Android quiere que se
    // lancen las pantallas, y se espera a saber si se pudo.
    private void abreNavegador(String url) throws Exception {
        final Exception[] fallo = { null };
        final java.util.concurrent.CountDownLatch hecho = new java.util.concurrent.CountDownLatch(1);
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                i.addCategory(Intent.CATEGORY_BROWSABLE);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
            } catch (Exception e) {
                fallo[0] = e;
            } finally {
                hecho.countDown();
            }
        });
        if (!hecho.await(5, java.util.concurrent.TimeUnit.SECONDS)) throw new Exception("el teléfono no contestó");
        if (fallo[0] != null) throw fallo[0];
    }

    // Que la app vuelva delante sola en cuanto el navegador trae el código. Si
    // Android no lo deja (no siempre deja a una app en segundo plano), queda el
    // botón «Volver a Oddinote» de la página del navegador.
    private void traeAlFrente() {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                Intent i = new Intent(getContext(), MainActivity.class);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                getContext().startActivity(i);
            } catch (Exception e) {
                Log.i(ETIQUETA, "Android no dejó volver delante sola: " + e.getMessage());
            }
        });
    }

    // ── El token de refresco, cifrado ──

    private SharedPreferences preferencias() {
        return getContext().getSharedPreferences(PREFERENCIAS, Context.MODE_PRIVATE);
    }

    private SecretKey llave() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (ks.containsAlias(LLAVE)) return ((KeyStore.SecretKeyEntry) ks.getEntry(LLAVE, null)).getSecretKey();
        KeyGenerator g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        g.init(new KeyGenParameterSpec.Builder(LLAVE, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .build());
        return g.generateKey();
    }

    private void guardaRefresco(String token) {
        try {
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, llave());
            byte[] cifrado = c.doFinal(token.getBytes(StandardCharsets.UTF_8));
            String guardado = Base64.encodeToString(c.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(cifrado, Base64.NO_WRAP);
            preferencias().edit().putString(CLAVE_REFRESCO, guardado).apply();
        } catch (Exception e) {
            // Sin cifrado no se guarda en claro: mejor pedir la cuenta otra vez
            // que dejar la llave de Drive escrita en un archivo.
            Log.w(ETIQUETA, "No se pudo guardar el token de refresco: " + e.getMessage());
        }
    }

    private String leeRefresco() {
        String guardado = preferencias().getString(CLAVE_REFRESCO, null);
        if (guardado == null) return null;
        try {
            String[] partes = guardado.split(":");
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, llave(), new GCMParameterSpec(128, Base64.decode(partes[0], Base64.NO_WRAP)));
            return new String(c.doFinal(Base64.decode(partes[1], Base64.NO_WRAP)), StandardCharsets.UTF_8);
        } catch (Exception e) {
            Log.w(ETIQUETA, "El token de refresco guardado no se puede leer: " + e.getMessage());
            borraRefresco();
            return null;
        }
    }

    private void borraRefresco() {
        preferencias().edit().remove(CLAVE_REFRESCO).apply();
    }
}
