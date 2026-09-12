package io.github.neuroxcx1.oddinote;

import android.os.Bundle;
import android.util.TypedValue;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Apartar la aplicación de la barra de estado y de la de navegación.
 *
 * Capacitor dibuja la aplicación de borde a borde: la ventana empieza en el
 * píxel cero de la pantalla, así que la barra superior de Oddinote quedaba
 * DEBAJO del reloj y la batería. Se veía, pero al tocarla el toque se lo quedaba
 * el sistema: era imposible darle a los botones de arriba.
 *
 * Lo intenté primero desde el CSS, con env(safe-area-inset-top), y no sirve: en
 * Android eso mide la MUESCA de la pantalla, no la barra de estado, y en este
 * teléfono vale cero. Tampoco sirve bajar targetSdk a 34 — probado: la ventana
 * sigue empezando en cero, porque quien la pone así es Capacitor y no el
 * sistema. Medido con la aplicación abierta: screenY = 0, la barra de Oddinote
 * en y = 0 y sus botones entre y = 5 e y = 43.
 *
 * Así que se resuelve donde se puede: se le pide al sistema cuánto ocupan sus
 * barras y se aparta el contenido esa cantidad. Al ser una medida del propio
 * teléfono, vale igual en uno con muesca, en uno con botones en pantalla y en
 * horizontal, sin números escritos a mano en ningún sitio.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        View contenido = findViewById(android.R.id.content);
        if (contenido == null) return;

        // La franja que queda al apartar el contenido enseña el fondo de la
        // ventana. Se pinta con el color de fondo del tema para que acompañe al
        // modo claro y al oscuro en vez de salir un rectángulo negro.
        TypedValue color = new TypedValue();
        if (getTheme().resolveAttribute(android.R.attr.colorBackground, color, true)) {
            contenido.setBackgroundColor(color.data);
        }

        ViewCompat.setOnApplyWindowInsetsListener(contenido, (vista, insets) -> {
            // systemBars = la de estado y la de navegación. La muesca va aparte
            // y también cuenta: en horizontal es la que se come el lado.
            Insets barras = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            vista.setPadding(barras.left, barras.top, barras.right, barras.bottom);

            // Y se DAN POR CONSUMIDAS. Si no, la página las recibe otra vez y
            // las vuelve a descontar por su cuenta con env(safe-area-inset-*):
            // la medida se aplicaría dos veces y quedaba un hueco del doble de
            // alto. Medido: la barra de búsqueda se iba a y=104 en vez de y=57.
            //
            // Las reglas de CSS con env(...) se quedan igual, que ahí no
            // estorban: en el navegador y en un iPhone no hay nadie apartando
            // nada por debajo, y son ellas las que hacen el trabajo.
            return WindowInsetsCompat.CONSUMED;
        });
    }
}
