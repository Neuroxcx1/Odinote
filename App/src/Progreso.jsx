// =====================================================
// Oddinote — el nodo de progreso
//
// Pedido por el usuario: una barra de 0 a 100 de cuánto está hecho del
// proyecto, que cuente sola las casillas de todas las listas de tareas. Se
// puede poner varias veces, y cada una puede contar el proyecto entero o solo
// el tablero donde está (con lo que tenga dentro). Lo que cuenta y cómo vive
// en progreso.js (window.OdiProgreso), con sus pruebas.
//
// No guarda el número: lo calcula al pintarse, así que siempre está al día y
// no hay nada que sincronizar. Al cambiar, la barra se llena deslizándose y el
// número sube contando; al llegar al 100 %, confeti.
// =====================================================

// El número de la barra sube contando hasta el nuevo, en vez de saltar.
function useNumeroQueCuenta(objetivo) {
  const [mostrado, setMostrado] = React.useState(objetivo);
  const desde = React.useRef(objetivo);
  React.useEffect(() => {
    const inicio = performance.now(), de = desde.current, dura = 650;
    if (de === objetivo) return;
    let raf;
    const paso = (t) => {
      const f = Math.min(1, (t - inicio) / dura);
      const suave = 1 - Math.pow(1 - f, 3);
      const v = Math.round(de + (objetivo - de) * suave);
      setMostrado(v);
      desde.current = v;
      if (f < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [objetivo]);
  return mostrado;
}

function ProgresoItem({ item, lang, callbacks }) {
  const alcance = item.alcance === 'tablero' ? 'tablero' : 'proyecto';
  const c = callbacks && callbacks.cuentaProgreso
    ? callbacks.cuentaProgreso(alcance)
    : { hechas: 0, total: 0, porcentaje: 0 };
  const pct = c.porcentaje;
  const lleno = c.total > 0 && c.hechas === c.total;
  const numero = useNumeroQueCuenta(pct);
  const cajaRef = React.useRef(null);

  // Confeti la vez que llega al 100 %, no cada vez que se pinta en 100.
  const antes = React.useRef(pct);
  React.useEffect(() => {
    if (pct === 100 && antes.current < 100 && c.total > 0) {
      window.odiConfeti && cajaRef.current && window.odiConfeti(cajaRef.current);
      window.playAudioTone && window.playAudioTone('create');
    }
    antes.current = pct;
  }, [pct]);

  const titulo = alcance === 'tablero'
    ? window.t('Progreso de este tablero', 'This board’s progress')
    : window.t('Progreso del proyecto', 'Project progress');
  const pie = c.total
    ? window.t(`${c.hechas} de ${c.total} tareas hechas`, `${c.hechas} of ${c.total} tasks done`)
    : window.t('Todavía no hay tareas: pon una lista de tareas y se contará sola.', 'No tasks yet: add a to-do list and it will be counted.');

  return (
    <div
      ref={cajaRef}
      className={`progreso ${lleno ? 'lleno' : ''} ${c.total ? '' : 'vacio'}`}
      style={{ background: window.nodeBg ? window.nodeBg(item) : 'var(--paper)' }}
    >
      <div className="progreso-cabeza">
        <span className="progreso-titulo">
          <span className="material-symbols-rounded">{lleno ? 'task_alt' : 'donut_large'}</span>
          {titulo}
        </span>
        <span className="progreso-pct">{numero}<small>%</small></span>
      </div>
      <div className="progreso-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={pct}>
        <div className="progreso-relleno" style={{ width: pct + '%' }}/>
        {/* Las marcas del 25, 50 y 75 %: se ve de un vistazo por dónde va. */}
        <i style={{ left: '25%' }}/><i style={{ left: '50%' }}/><i style={{ left: '75%' }}/>
      </div>
      <div className="progreso-pie">{pie}</div>
    </div>
  );
}

window.ProgresoItem = ProgresoItem;
