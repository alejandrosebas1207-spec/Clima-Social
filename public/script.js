// ==========================================
// DASHBOARD — Encuesta Artes y Cultura (3ra edición)
// Tabs: Todos / Trabajadores / Graduados UArtes
// Conteo DISJUNTO usando el campo 'grad' como discriminador.
// ==========================================

let META_TRABAJADORES = 2100;
let META_GRADUADOS = 400;
let VALOR_SI = "1";
let FECHA_CIERRE = "2026-09-19";

let filtroActual = "todos";
let filtroProvinciaActual = null;
let ultimosDatosCargados = null;
let ultimaActualizacionExitos = null;

const INTERVALO_AUTOREFRESCO = 3 * 60 * 1000;
const QUIEBRE_MOVIL = 700;

function esModoOscuro() {
    return document.body.classList.contains("modo-oscuro");
}

function cssVar(nombre) {
    return getComputedStyle(document.body).getPropertyValue(nombre).trim();
}

const COLOR_TEXTO = () => esModoOscuro() ? "#a99880" : "#7a6d5c";
const COLOR_TITULO = () => esModoOscuro() ? "#f2ecdf" : "#241e15";
const COLOR_GRID = () => esModoOscuro() ? "#3d3225" : "#e7dfd0";

// ==========================================
// RESOLVER DE CAMPOS (Kobo anida en grupos)
// ==========================================

function campo(encuesta, nombreCorto) {
    if (!encuesta) return undefined;
    if (encuesta[nombreCorto] !== undefined) return encuesta[nombreCorto];
    const clavePrefijo = Object.keys(encuesta).find(k => k.endsWith("/" + nombreCorto));
    if (clavePrefijo) return encuesta[clavePrefijo];
    for (let key in encuesta) {
        if (typeof encuesta[key] === 'object' && encuesta[key] !== null) {
            const val = campo(encuesta[key], nombreCorto);
            if (val !== undefined) return val;
        }
    }
    return undefined;
}

// ==========================================
// MAPAS DE ETIQUETAS
// ==========================================

const MAPA_PROVINCIA = {
    "1": "Azuay", "2": "Bolívar", "3": "Cañar", "4": "Carchi",
    "5": "Chimborazo", "6": "Cotopaxi", "7": "Imbabura", "8": "Loja",
    "9": "Pichincha", "10": "Tungurahua", "11": "Santo Domingo", "12": "El Oro",
    "13": "Esmeraldas", "14": "Guayas", "15": "Los Ríos", "16": "Manabí",
    "17": "Santa Elena", "18": "Morona Santiago", "19": "Napo", "20": "Orellana",
    "21": "Pastaza", "22": "Sucumbíos", "23": "Zamora Chinchipe", "24": "Galápagos"
};

// Metas de trabajadores por provincia (suma = 2100)
const META_PROVINCIA = {
    "9": 740,   // Pichincha
    "14": 340,  // Guayas
    "1": 160,   // Azuay
    "16": 135,  // Manabí
    "10": 110,  // Tungurahua
    "7": 105,   // Imbabura
    "5": 65,    // Chimborazo
    "8": 65,    // Loja
    "6": 65,    // Cotopaxi
    "17": 60,   // Santa Elena
    "21": 55,   // Pastaza
    "20": 55,   // Orellana
    "11": 55,   // Santo Domingo
    "19": 50,   // Napo
    "12": 40    // El Oro
};

const MAPA_GENERO = {
    "1": "Femenino", "2": "Masculino", "3": "No binario", "0": "Prefiere no responder"
};

const MAPA_MEDIO = {
    "1": "Link por correo electrónico",
    "2": "Llamada telefónica (WhatsApp)",
    "3": "Código QR",
    "4": "Facilitador",
    "5": "Redes sociales"
};

const MAPA_TITULO = {
    "1": "Lic. Artes Visuales",
    "2": "Lic. Artes Musicales",
    "3": "Lic. Creación Teatral",
    "4": "Lic. Cine",
    "5": "Lic. Literatura",
    "6": "Lic. Producción Musical",
    "6_1": "Lic. Danza",
    "7": "Máster Cine Documental",
    "8": "Máster Artes Visuales y Nuevos Medios",
    "9": "Máster Artes Escénicas",
    "10": "Máster Composición Musical",
    "11": "Máster Escritura Creativa",
    "12": "Máster Políticas Culturales",
    "13": "Máster Fotografía y Sociedad"
};

const MAPA_ACTIVIDAD_BUCKET = {
    "1": "Artes musicales",
    "2": "Literatura",
    "3": "Audiovisual",
    "4": "Escénicas",
    "5": "Visuales",
    "6": "Visuales",
    "7": "Otras",
    "8": "Audiovisual",
    "9": "Otras",
    "10": "Gestión cultural",
    "11": "Otras",
    "12": "Otras"
};

const ORDEN_ACTIVIDAD = ["Artes musicales", "Visuales", "Escénicas", "Gestión cultural", "Audiovisual", "Literatura", "Otras"];

const COLORES_ACTIVIDAD = {
    "Artes musicales": "var(--kimi-chart-1)",
    "Visuales": "var(--kimi-chart-4)",
    "Escénicas": "var(--kimi-chart-2)",
    "Gestión cultural": "var(--kimi-chart-3)",
    "Audiovisual": "#8a4b6b",
    "Literatura": "var(--kimi-chart-6)",
    "Otras": "var(--kimi-chart-5)"
};

async function obtenerConfig() {
    try {
        const respuesta = await fetch("/api/config");
        if (!respuesta.ok) throw new Error("No se pudo obtener configuración");
        const config = await respuesta.json();
        META_TRABAJADORES = Number(config.metaTrabajadores) || 2100;
        META_GRADUADOS = Number(config.metaGraduados) || 400;
        VALOR_SI = config.valorConsentimientoSi || "1";
        FECHA_CIERRE = config.fechaCierre || "2026-09-19";
        const elTitulo = document.getElementById("tituloProyecto");
        if (elTitulo) elTitulo.textContent = config.nombreProyecto || "Encuesta Artes y Cultura";
        document.title = config.nombreProyecto || "Encuesta Artes y Cultura";
    } catch (error) {
        console.warn("Usando configuración por defecto", error);
    }
}

// ==========================================
// ACCIONES DE CABECERA (CSV / PDF)
// ==========================================

function inicializarAccionesCabecera() {
    const btnExportar = document.getElementById("btnExportarCSV");
    if (btnExportar) {
        btnExportar.addEventListener("click", exportarDatosCSV);
    }
    const btnPDF = document.getElementById("btnImprimirPDF");
    if (btnPDF) {
        btnPDF.addEventListener("click", () => window.print());
    }
    const btnLimpiar = document.getElementById("btnLimpiarFiltroProvincia");
    if (btnLimpiar) {
        btnLimpiar.addEventListener("click", () => {
            filtroProvinciaActual = null;
            const franja = document.getElementById("franjaFiltroActivo");
            if (franja) franja.style.display = "none";
            renderizarTodo();
        });
    }
}

function exportarDatosCSV() {
    if (!ultimosDatosCargados || !ultimosDatosCargados.todos) {
        alert("Aún no hay datos cargados para exportar.");
        return;
    }
    const datos = ultimosDatosCargados.todos;
    const filas = [
        ["ID", "Fecha_Submission", "Tipo_Encuesta", "Provincia", "Genero", "Actividad_Principal", "Medio_Captura"]
    ];

    datos.forEach((e, idx) => {
        const id = e._id || (idx + 1);
        const fecha = obtenerFechaDia(e) || "";
        const gradVal = campo(e, "grad");
        const tipo = gradVal === "1" ? "Graduado UArtes" : "Trabajador";
        const provCode = campo(e, "prov");
        const provNombre = MAPA_PROVINCIA[provCode] || "No especificado";
        const genCode = campo(e, "genero");
        const genNombre = MAPA_GENERO[genCode] || "No especificado";
        const actCode = campo(e, "act_principal");
        const actBucket = MAPA_ACTIVIDAD_BUCKET[actCode] || "Otras";
        const medioCode = campo(e, "medio");
        const medioNombre = MAPA_MEDIO[medioCode] || "No especificado";

        filas.push([id, fecha, tipo, provNombre, genNombre, actBucket, medioNombre]);
    });

    const contenidoCSV = "\uFEFF" + filas.map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([contenidoCSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Clima_Social_Reporte_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

document.addEventListener("DOMContentLoaded", inicializarAccionesCabecera);

// ==========================================
// MODO OSCURO (persistente)
// ==========================================

const CLAVE_MODO = "clima-social-modo";

function aplicarModoOscuro(activo) {
    document.body.classList.toggle("modo-oscuro", activo);
    const boton = document.getElementById("botonModoOscuro");
    if (boton) {
        boton.textContent = activo ? "☀️" : "🌙";
        boton.title = activo ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
        boton.setAttribute("aria-pressed", String(activo));
    }
    requestAnimationFrame(() => {
        if (ultimosDatosCargados) renderizarTodo();
    });
}

function inicializarModoOscuro() {
    const activo = localStorage.getItem(CLAVE_MODO) === "1";
    aplicarModoOscuro(activo);
    const botonModoOscuro = document.getElementById("botonModoOscuro");
    if (botonModoOscuro && !botonModoOscuro.dataset.vinculado) {
        botonModoOscuro.dataset.vinculado = "true";
        botonModoOscuro.addEventListener("click", () => {
            const activo = !esModoOscuro();
            localStorage.setItem(CLAVE_MODO, activo ? "1" : "0");
            aplicarModoOscuro(activo);
        });
    }
}

async function obtenerDatos(silencioso = false) {
    try {
        if (!silencioso) await obtenerConfig();
        const respuesta = await fetch("/api/encuestas");
        if (!respuesta.ok) throw new Error("Servidor Node o API Kobo no respondió.");
        const datos = await respuesta.json();
        
        // Manejar distintivo de datos en respaldo
        const bannerFallback = document.getElementById("bannerFallback");
        if (bannerFallback) {
            if (datos.esCacheFallback) {
                bannerFallback.style.display = "flex";
                bannerFallback.innerHTML = `<span class="icono-fallback">💾</span> <span><strong>Modo Respaldo:</strong> Mostrando última versión guardada de los datos (${new Date(datos.obtenidoEn || Date.now()).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}).</span>`;
            } else {
                bannerFallback.style.display = "none";
            }
        }

        ocultarCarga();
        ocultarError();
        procesarDatos(datos);
        ultimaActualizacionExitos = new Date();
        actualizarTimestamp();
    } catch (error) {
        console.warn("[CLIMA-SOCIAL] ⚠ Servidor Node.js no detectado o sin credenciales de Kobo. Activando vista estática de demostración:", error.message);
        
        // Cargar datos estáticos de demostración para no bloquear la interfaz jamás
        const datosDemo = generarDatosDemoEstaticos();
        const bannerFallback = document.getElementById("bannerFallback");
        if (bannerFallback) {
            bannerFallback.style.display = "flex";
            bannerFallback.innerHTML = `<span class="icono-fallback">⚡</span> <span><strong>Vista Estática / Demostración:</strong> Servidor Node.js no activo. Para conectar con Kobo en vivo, ejecuta <code>npm start</code> en tu terminal y abre <a href="http://localhost:3000" style="color:inherit;font-weight:bold;">http://localhost:3000</a>.</span>`;
        }

        ocultarCarga();
        ocultarError();
        procesarDatos(datosDemo);
        ultimaActualizacionExitos = new Date();
        actualizarTimestamp();
    }
}

function generarDatosDemoEstaticos() {
    const provinces = ['9','9','9','9','14','14','14','1','16','10','7','5','8','6','17','21','20','11','19','12'];
    const generos = ['1','1','2','2','3','0'];
    const actividades = ['1','2','3','4','5','6','7','8','10'];
    const medios = ['1','2','3','4','5'];
    const titulos = ['1','2','3','4','5','6','6_1','7','8','9'];
    const anios = ['2019','2020','2021','2022','2023','2024','2025'];
    const resultados = [];
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - 12);

    for (let i = 0; i < 480; i++) {
        const isTrab = i % 3 !== 0;
        const d = new Date(baseDate.getTime() + Math.floor(Math.random() * 12 * 86400000));
        const start = d.toISOString();
        const end = new Date(d.getTime() + (10 + Math.floor(Math.random() * 20)) * 60000).toISOString();
        resultados.push({
            _id: i + 1,
            grad: isTrab ? '2' : '1',
            consent: '1',
            consentuartes: '1',
            prov: provinces[Math.floor(Math.random() * provinces.length)],
            genero: generos[Math.floor(Math.random() * generos.length)],
            act_principal: actividades[Math.floor(Math.random() * actividades.length)],
            medio: medios[Math.floor(Math.random() * medios.length)],
            anio_grad: anios[Math.floor(Math.random() * anios.length)],
            titulo_obtenido: titulos[Math.floor(Math.random() * titulos.length)],
            start,
            end,
            _submission_time: start
        });
    }
    return { total: resultados.length, resultados, esCacheFallback: true, obtenidoEn: Date.now() };
}

function actualizarTimestamp() {
    const el = document.getElementById("ultimaActualizacion");
    if (!el) return;
    const ahora = new Date();
    const hora = ahora.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });

    let relativo = "";
    if (ultimaActualizacionExitos) {
        const segundos = Math.max(0, Math.floor((ahora - ultimaActualizacionExitos) / 1000));
        if (segundos < 60) relativo = " hace un momento";
        else if (segundos < 3600) relativo = ` hace ${Math.floor(segundos / 60)} min`;
        else relativo = ` hace ${Math.floor(segundos / 3600)} h`;
    }

    el.innerHTML = `<span class="punto-vivo" aria-hidden="true"></span>Última actualización: ${hora}${relativo}`;
}

setInterval(() => {
    obtenerDatos(true);
    actualizarTimestamp();
}, INTERVALO_AUTOREFRESCO);

function ocultarCarga() {
    const overlay = document.getElementById("cargaOverlay");
    if (overlay) {
        overlay.classList.add("oculto");
        overlay.style.display = "none";
        overlay.setAttribute("aria-hidden", "true");
    }
}

function mostrarError() {
    const banner = document.getElementById("errorBanner");
    if (banner) banner.style.display = "flex";
}

function ocultarError() {
    const banner = document.getElementById("errorBanner");
    if (banner) banner.style.display = "none";
}

const botonReintentar = document.getElementById("botonReintentar");
if (botonReintentar) {
    botonReintentar.addEventListener("click", () => {
        ocultarError();
        mostrarCarga();
        obtenerDatos();
    });
}

function mostrarCarga() {
    const overlay = document.getElementById("cargaOverlay");
    if (overlay) {
        overlay.classList.remove("oculto");
        overlay.style.display = "flex";
        overlay.setAttribute("aria-hidden", "false");
    }
}

// Inicialización diferida al cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
    inicializarModoOscuro();
    obtenerDatos();
});

// ==========================================
// PROCESAMIENTO PRINCIPAL — CONTEO DISJUNTO
// ==========================================

function procesarDatos(datos) {
    if (!datos || !Array.isArray(datos.resultados)) {
        console.warn("Los datos recibidos no contienen la lista 'resultados'.", datos);
        ultimosDatosCargados = {
            trabajadores: [],
            graduados: [],
            todos: [],
            noAceptaronTrabajadores: 0,
            noAceptaronGraduados: 0,
            noAceptaronTotal: 0
        };
        renderizarTodo();
        return;
    }

    ultimosDatosCargados = datos;

    const esGraduado = e => campo(e, "grad") === "1" && campo(e, "consentuartes") === VALOR_SI;
    const esTrabajador = e => campo(e, "grad") === "2" && campo(e, "consent") === VALOR_SI;
    const noAceptoTrabajador = e => campo(e, "grad") === "2" && campo(e, "consent") !== VALOR_SI;
    const noAceptoGraduado = e => campo(e, "grad") === "1" && campo(e, "consentuartes") !== VALOR_SI;

    const graduados = datos.resultados.filter(esGraduado);
    const trabajadores = datos.resultados.filter(esTrabajador);
    const noAceptaronTrabajadores = datos.resultados.filter(noAceptoTrabajador);
    const noAceptaronGraduados = datos.resultados.filter(noAceptoGraduado);
    const todos = [...trabajadores, ...graduados];

    ultimosDatosCargados.trabajadores = trabajadores;
    ultimosDatosCargados.graduados = graduados;
    ultimosDatosCargados.noAceptaronTrabajadores = noAceptaronTrabajadores.length;
    ultimosDatosCargados.noAceptaronGraduados = noAceptaronGraduados.length;
    ultimosDatosCargados.noAceptaronTotal = noAceptaronTrabajadores.length + noAceptaronGraduados.length;
    ultimosDatosCargados.todos = todos;

    renderizarTodo();
}

// ==========================================
// RENDERIZAR TODO
// ==========================================

function renderizarTodo() {
    if (!ultimosDatosCargados) return;

    const {
        trabajadores,
        graduados,
        todos,
        noAceptaronTotal,
        noAceptaronTrabajadores,
        noAceptaronGraduados
    } = ultimosDatosCargados;
    const metaTotal = META_TRABAJADORES + META_GRADUADOS;

    // --- KPIs fijos (totales) ---
    animarNumero("kpiTotal", todos.length);
    animarNumero("kpiTrabajadores", trabajadores.length);
    animarNumero("kpiGraduados", graduados.length);

    // --- Barras de progreso y metas ---
    setBarra("barraTrabajadores", trabajadores.length, META_TRABAJADORES);
    setBarra("barraGraduados", graduados.length, META_GRADUADOS);
    document.getElementById("metaTrabajadores").textContent = `Meta: ${META_TRABAJADORES}`;
    document.getElementById("metaGraduados").textContent = `Meta: ${META_GRADUADOS}`;
    document.getElementById("kpiTotalNoAceptaron").textContent = `No aceptaron participar: ${noAceptaronTotal}`;
    document.getElementById("kpiTrabajadoresNoAceptaron").textContent = `No aceptaron participar: ${noAceptaronTrabajadores}`;
    document.getElementById("kpiGraduadosNoAceptaron").textContent = `No aceptaron participar: ${noAceptaronGraduados}`;

    // --- Elegir conjunto de datos según filtro ---
    let conjunto;
    if (filtroActual === "todos") conjunto = todos;
    else if (filtroActual === "trabajadores") conjunto = trabajadores;
    else if (filtroActual === "graduados") conjunto = graduados;
    else conjunto = todos;

    // --- Deltas vs ayer ---
    const deltaTotal = contarDelta(todos, "totalDelta");
    const deltaTrab = contarDelta(trabajadores, "trabajadoresDelta");
    const deltaGrad = contarDelta(graduados, "graduadosDelta");
    document.getElementById("kpiTotalDelta").innerHTML = `Ayer: <strong>${deltaTotal.ayer}</strong> · ${deltaTotal.texto}`;
    document.getElementById("kpiTrabajadoresDelta").innerHTML = `Ayer: <strong>${deltaTrab.ayer}</strong> · ${deltaTrab.texto}`;
    document.getElementById("kpiGraduadosDelta").innerHTML = `Ayer: <strong>${deltaGrad.ayer}</strong> · ${deltaGrad.texto}`;
    const deltaHoy = contarDelta(conjunto, "hoyDelta");
    document.getElementById("kpiHoyDelta").innerHTML = `vs ayer · ${deltaHoy.texto}`;
    document.getElementById("kpiTotalDelta").className = "kpi-delta " + deltaTotal.clase;
    document.getElementById("kpiTrabajadoresDelta").className = "kpi-delta " + deltaTrab.clase;
    document.getElementById("kpiGraduadosDelta").className = "kpi-delta " + deltaGrad.clase;
    document.getElementById("kpiHoyDelta").className = "kpi-delta " + deltaHoy.clase;
    // Ayer del avance (sin barra de progreso, es numérico)
    document.getElementById("kpiAvanceDelta").innerHTML = `Ayer: <strong>${deltaTotal.ayer}</strong> (${deltaTotal.ayerAbs} total)`;
    document.getElementById("kpiAvanceDelta").className = "kpi-delta " + deltaTotal.clase;

    // --- Avance general según filtro ---
    let metaSegmento;
    let totalSegmento;
    if (filtroActual === "todos") {
        metaSegmento = metaTotal;
        totalSegmento = todos.length;
    } else if (filtroActual === "trabajadores") {
        metaSegmento = META_TRABAJADORES;
        totalSegmento = trabajadores.length;
    } else if (filtroActual === "graduados") {
        metaSegmento = META_GRADUADOS;
        totalSegmento = graduados.length;
    } else {
        metaSegmento = metaTotal;
        totalSegmento = todos.length;
    }
    const avance = metaSegmento > 0 ? ((totalSegmento / metaSegmento) * 100) : 0;
    document.getElementById("donutAvance").style.setProperty("--avance", Math.min(100, avance).toString());
    animarNumero("kpiAvance", Number(avance.toFixed(1)), "%");
    document.getElementById("kpiMeta").textContent = `${totalSegmento} de ${metaSegmento}`;
    setBarra("barraAvance", totalSegmento, metaSegmento);

    // --- Duración promedio y Desviación estándar (con filtro <= 45 min) ---
    const statsTrab = calcularEstadisticasDuracion(trabajadores);
    const statsGrad = calcularEstadisticasDuracion(graduados);
    const statsConjunto = calcularEstadisticasDuracion(conjunto);

    const txtConjunto = statsConjunto ? formatearDuracion(statsConjunto.promedio) : "--";
    const txtTrab = statsTrab ? formatearDuracion(statsTrab.promedio) : "--";
    const txtGrad = statsGrad ? formatearDuracion(statsGrad.promedio) : "--";
    const devTrab = statsTrab ? formatearDesviacion(statsTrab.desviacion) : "";
    const devGrad = statsGrad ? formatearDesviacion(statsGrad.desviacion) : "";

    const elDuracion = document.getElementById("kpiDuracion");
    if (elDuracion) {
        elDuracion.textContent = txtConjunto;
    }

    const elDurDetalle = document.getElementById("kpiDuracionDetalle");
    if (elDurDetalle) {
        if (filtroActual === "todos") {
            const partTrab = devTrab ? `${txtTrab} (${devTrab})` : txtTrab;
            const partGrad = devGrad ? `${txtGrad} (${devGrad})` : txtGrad;
            elDurDetalle.innerHTML = `<div>Trabajadores: ${partTrab}</div><div>Graduados: ${partGrad}</div>`;
        } else if (filtroActual === "trabajadores") {
            const partTrab = devTrab ? `${txtTrab} (${devTrab})` : txtTrab;
            elDurDetalle.innerHTML = `<div>Trabajadores: ${partTrab}</div><div>Sesiones ≤ 45 min</div>`;
        } else if (filtroActual === "graduados") {
            const partGrad = devGrad ? `${txtGrad} (${devGrad})` : txtGrad;
            elDurDetalle.innerHTML = `<div>Graduados: ${partGrad}</div><div>Sesiones ≤ 45 min</div>`;
        }
    }

    // --- KPI: Encuestas hoy ---
    const hoy = hoyEcuador();
    const encuestasHoy = conjunto.filter(e => obtenerFechaDia(e) === hoy);
    const totalHoy = encuestasHoy.length;

    let detalleHoy = '';
    if (filtroActual === 'todos') {
        const trabajadoresHoy = trabajadores.filter(e => obtenerFechaDia(e) === hoy).length;
        const graduadosHoy = graduados.filter(e => obtenerFechaDia(e) === hoy).length;
        detalleHoy = `Trabajadores: ${trabajadoresHoy} · Graduados: ${graduadosHoy}`;
    } else if (filtroActual === 'trabajadores') {
        detalleHoy = `Trabajadores: ${totalHoy}`;
    } else if (filtroActual === 'graduados') {
        detalleHoy = `Graduados: ${totalHoy}`;
    }
    animarNumero('kpiHoy', totalHoy);
    document.getElementById('kpiHoyDetalle').textContent = detalleHoy;

    // --- Sparklines en KPIs ---
    dibujarSparkline(todos, "sparkTotal", "--kimi-chart-1");
    dibujarSparkline(trabajadores, "sparkTrabajadores", "--kimi-chart-1");
    dibujarSparkline(graduados, "sparkGraduados", "--kimi-chart-3");
    dibujarSparkline(todos, "sparkAvance", "--kimi-chart-4");

    // --- Franja de estado de campaña ---
    const fechasTodos = todos
        .map(e => new Date(campo(e, "start") || e._submission_time))
        .filter(d => !isNaN(d));
    const diasActivos = fechasTodos.length
        ? Math.max(1, Math.ceil((new Date() - new Date(Math.min(...fechasTodos))) / 86400000))
        : 0;
    const diaCounts = {};
    todos.forEach(e => { const d = obtenerFechaDia(e); if (d) diaCounts[d] = (diaCounts[d] || 0) + 1; });
    let mejorDia = "—";
    let mejorDiaCount = 0;
    Object.entries(diaCounts).forEach(([d, n]) => { if (n > mejorDiaCount) { mejorDiaCount = n; mejorDia = d.split("-").slice(1).reverse().join("/"); } });
    document.getElementById("franjaEstado").innerHTML = `
        <span class="franja-estado-item">
            <span class="franja-estado-icono campana" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
            </span>
            <span><strong>${diasActivos}</strong> días</span>
        </span>
        <span class="franja-estado-item">
            <span class="franja-estado-icono mejor-dia" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10"/><path d="M17 4v4a5 5 0 0 1-10 0V4"/><path d="M5 4H3v3a4 4 0 0 0 4 4"/><path d="M19 4h2v3a4 4 0 0 1-4 4"/></svg>
            </span>
            <span>mejor día <strong>${mejorDia}</strong> (${mejorDiaCount})</span>
        </span>
    `;
    renderizarFranjaCierre(todos, metaTotal, diasActivos);

    // --- Visibilidad de gráficos exclusivos de graduados ---
    document.querySelectorAll('[data-segmento="graduados"]').forEach(el => {
        el.classList.toggle("oculto", filtroActual === "trabajadores");
    });

    // --- Mostrar/ocultar badge en gráficos de graduados según filtro ---
    document.querySelectorAll('[data-segmento="graduados"] .badge-segmento').forEach(el => {
        el.style.display = (filtroActual === "todos") ? 'inline-block' : 'none';
    });

    // --- Aplicar filtro de provincia si está activo ---
    if (filtroProvinciaActual) {
        conjunto = conjunto.filter(e => String(campo(e, "prov")) === String(filtroProvinciaActual));
        const franja = document.getElementById("franjaFiltroActivo");
        const nombreEl = document.getElementById("nombreProvinciaFiltro");
        if (franja && nombreEl) {
            franja.style.display = "flex";
            nombreEl.textContent = MAPA_PROVINCIA[filtroProvinciaActual] || "Desconocida";
        }
    }

    // --- Gráficos y mapa ---
    generarGraficoSeguro("generarMapaEcuador", trabajadores, graduados, todos);
    generarGraficoSeguro("generarGraficoAvanceDia", trabajadores, graduados);
    generarGraficoSeguro("generarGraficoMedio", conjunto);
    generarGraficoSeguro("generarGraficoMedioPorDia", conjunto);
    generarGraficoSeguro("generarGraficoProvincia", conjunto);
    generarGraficoSeguro("generarGraficoGenero", conjunto);
    generarGraficoSeguro("generarGraficoActividad", conjunto);

    // --- Cruces de datos (barras apiladas) ---
    generarGraficoSeguro("generarGraficoCruceProvinciaActividad", conjunto);
    generarGraficoSeguro("generarGraficoCruceGeneroActividad", conjunto);

    // --- Gráficos exclusivos de graduados ---
    if (filtroActual !== "trabajadores") {
        generarGraficoSeguro("generarGraficoCruceAnioTitulo", graduados);
        generarGraficoSeguro("generarGraficoAnioGraduacion", graduados);
        generarGraficoSeguro("generarGraficoTitulo", graduados);
    } else {
        destruirChart("chartCruceAnioTitulo");
        destruirChart("chartAnioGraduacion");
        destruirChart("chartTitulo");
        mostrarN("nCruceAnioTitulo", 0);
        mostrarN("nAnioGraduacion", 0);
        mostrarN("nTitulo", 0);
    }
}

// ==========================================
// MAPA SVG INTERACTIVO DE ECUADOR
// ==========================================

const RUTAS_PROVINCIAS_SVG = {
    "4": { n: "Carchi", d: "M 270,30 L 300,20 L 310,45 L 285,55 Z" },
    "13": { n: "Esmeraldas", d: "M 180,35 L 270,30 L 255,85 L 175,90 Z" },
    "7": { n: "Imbabura", d: "M 270,55 L 310,45 L 305,80 L 265,80 Z" },
    "9": { n: "Pichincha", d: "M 235,85 L 305,80 L 295,125 L 225,120 Z" },
    "11": { n: "Santo Domingo", d: "M 185,90 L 235,85 L 225,135 L 180,125 Z" },
    "16": { n: "Manabí", d: "M 110,95 L 185,90 L 175,190 L 100,165 Z" },
    "6": { n: "Cotopaxi", d: "M 225,120 L 295,125 L 285,160 L 220,155 Z" },
    "10": { n: "Tungurahua", d: "M 255,160 L 300,155 L 295,190 L 250,190 Z" },
    "15": { n: "Los Ríos", d: "M 175,135 L 225,130 L 215,215 L 165,205 Z" },
    "2": { n: "Bolívar", d: "M 215,160 L 255,160 L 245,210 L 210,200 Z" },
    "5": { n: "Chimborazo", d: "M 245,190 L 305,185 L 295,240 L 235,235 Z" },
    "14": { n: "Guayas", d: "M 140,195 L 215,205 L 205,295 L 130,285 Z" },
    "17": { n: "Santa Elena", d: "M 75,215 L 140,195 L 130,270 L 65,260 Z" },
    "3": { n: "Cañar", d: "M 205,240 L 275,235 L 265,275 L 195,275 Z" },
    "1": { n: "Azuay", d: "M 195,275 L 285,270 L 275,335 L 185,330 Z" },
    "12": { n: "El Oro", d: "M 130,290 L 195,300 L 185,360 L 120,345 Z" },
    "8": { n: "Loja", d: "M 175,330 L 255,325 L 240,410 L 160,400 Z" },
    "22": { n: "Sucumbíos", d: "M 310,20 L 440,30 L 415,100 L 305,80 Z" },
    "19": { n: "Napo", d: "M 295,125 L 395,115 L 380,175 L 290,165 Z" },
    "20": { n: "Orellana", d: "M 380,100 L 475,110 L 455,180 L 365,165 Z" },
    "21": { n: "Pastaza", d: "M 295,175 L 460,180 L 435,255 L 285,240 Z" },
    "18": { n: "Morona Santiago", d: "M 275,240 L 435,255 L 405,345 L 265,325 Z" },
    "23": { n: "Zamora Chinchipe", d: "M 255,325 L 395,340 L 370,415 L 240,400 Z" },
    "24": { n: "Galápagos", d: "M 20,130 A 15,15 0 1,0 50,130 A 15,15 0 1,0 20,130 M 45,170 A 10,10 0 1,0 65,170 A 10,10 0 1,0 45,170" }
};

function generarMapaEcuador(trabajadores, graduados, todos) {
    const contenedor = document.getElementById("mapaEcuadorContenedor");
    if (!contenedor) return;

    // Calcular conteos por provincia
    const conteo = {};
    const dataset = filtroActual === "trabajadores" ? trabajadores : filtroActual === "graduados" ? graduados : todos;
    dataset.forEach(e => {
        const prov = String(campo(e, "prov") || "");
        if (prov) conteo[prov] = (conteo[prov] || 0) + 1;
    });

    let tooltip = document.getElementById("mapaTooltipEl");
    if (!tooltip) {
        tooltip = document.createElement("div");
        tooltip.id = "mapaTooltipEl";
        tooltip.className = "mapa-tooltip";
        contenedor.appendChild(tooltip);
    }

    let svgHTML = `<svg viewBox="0 0 500 440" xmlns="http://www.w3.org/2000/svg">`;
    Object.entries(RUTAS_PROVINCIAS_SVG).forEach(([code, data]) => {
        const totalProv = conteo[code] || 0;
        const metaProv = META_PROVINCIA[code] || 0;
        let color = "#8c7a67"; // Sin meta

        if (metaProv > 0) {
            const pct = (totalProv / metaProv) * 100;
            if (pct >= 100) color = "#2f6b45";
            else if (pct >= 50) color = "#c9862e";
            else color = "#b23a2e";
        } else if (totalProv > 0) {
            color = "#454a91";
        }

        const activa = String(filtroProvinciaActual) === String(code) ? "activa" : "";

        svgHTML += `<path d="${data.d}" class="provincia-path ${activa}" data-code="${code}" data-nombre="${data.n}" data-total="${totalProv}" data-meta="${metaProv}" fill="${color}" opacity="0.88" />`;
        // Etiqueta del nombre de la provincia principal
        if (["9","14","1","16","10","7","8"].includes(code)) {
            const cx = getCentroidX(data.d);
            const cy = getCentroidY(data.d);
            svgHTML += `<text x="${cx}" y="${cy}" font-size="10" font-weight="600" fill="#ffffff" text-anchor="middle" pointer-events="none">${data.n.substring(0, 4)}</text>`;
        }
    });
    svgHTML += `</svg>`;
    contenedor.innerHTML = svgHTML + tooltip.outerHTML;

    // Re-vincular eventos
    contenedor.querySelectorAll(".provincia-path").forEach(path => {
        path.addEventListener("mouseenter", e => {
            const code = path.dataset.code;
            const nombre = path.dataset.nombre;
            const total = path.dataset.total;
            const meta = path.dataset.meta;
            const pctText = meta > 0 ? ` (${Math.round((total / meta) * 100)}% de meta ${meta})` : "";
            
            const tt = document.getElementById("mapaTooltipEl");
            if (tt) {
                tt.innerHTML = `<strong>${nombre}</strong>: ${total} encuestas${pctText}`;
                tt.classList.add("visible");
            }
        });

        path.addEventListener("mousemove", e => {
            const tt = document.getElementById("mapaTooltipEl");
            if (tt) {
                const rect = contenedor.getBoundingClientRect();
                tt.style.left = `${e.clientX - rect.left}px`;
                tt.style.top = `${e.clientY - rect.top}px`;
            }
        });

        path.addEventListener("mouseleave", () => {
            const tt = document.getElementById("mapaTooltipEl");
            if (tt) tt.classList.remove("visible");
        });

        path.addEventListener("click", () => {
            const code = path.dataset.code;
            if (filtroProvinciaActual === code) {
                filtroProvinciaActual = null;
                const franja = document.getElementById("franjaFiltroActivo");
                if (franja) franja.style.display = "none";
            } else {
                filtroProvinciaActual = code;
            }
            renderizarTodo();
        });
    });
}

function getCentroidX(pathStr) {
    const numbers = pathStr.match(/\d+/g);
    if (!numbers) return 250;
    let sum = 0;
    for (let i = 0; i < numbers.length; i += 2) sum += Number(numbers[i]);
    return sum / (numbers.length / 2);
}

function getCentroidY(pathStr) {
    const numbers = pathStr.match(/\d+/g);
    if (!numbers) return 220;
    let sum = 0;
    for (let i = 1; i < numbers.length; i += 2) sum += Number(numbers[i]);
    return sum / (numbers.length / 2);
}

// Aísla cada gráfico: si uno falla al renderizar (p. ej. al cambiar
// de modo oscuro), los demás se dibujan igual con los colores nuevos.
function generarGraficoSeguro(nombreFuncion, ...args) {
    try {
        window[nombreFuncion](...args);
    } catch (error) {
        console.error(`Error al generar ${nombreFuncion}:`, error);
    }
}

// ==========================================
// TABS
// ==========================================

document.querySelectorAll(".tab").forEach(boton => {
    boton.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(b => {
            b.classList.remove("activo");
            b.setAttribute("aria-selected", "false");
        });
        boton.classList.add("activo");
        boton.setAttribute("aria-selected", "true");
        filtroActual = boton.dataset.tab;
        renderizarTodo();
    });
});

// ==========================================
// DURACIÓN PROMEDIO Y DESVIACIÓN ESTÁNDAR
// ==========================================

function calcularEstadisticasDuracion(registros) {
    const minutosLista = [];
    registros.forEach(encuesta => {
        const inicio = campo(encuesta, "start");
        const fin = campo(encuesta, "end");
        if (!inicio || !fin) return;
        const t1 = new Date(inicio).getTime();
        const t2 = new Date(fin).getTime();
        if (isNaN(t1) || isNaN(t2) || t2 <= t1) return;
        const minutos = (t2 - t1) / 60000;
        if (minutos > 45) return; // Filtrar sesiones inactivas/pausas (> 45 min)
        minutosLista.push(minutos);
    });

    const n = minutosLista.length;
    if (n === 0) return null;

    const promedio = minutosLista.reduce((acc, m) => acc + m, 0) / n;
    
    let desviacion = 0;
    if (n > 1) {
        const sumaVarianza = minutosLista.reduce((acc, m) => acc + Math.pow(m - promedio, 2), 0);
        desviacion = Math.sqrt(sumaVarianza / (n - 1));
    }

    return { promedio, desviacion, n };
}

function calcularDuracionPromedio(registros) {
    const stats = calcularEstadisticasDuracion(registros);
    return stats ? stats.promedio : null;
}

function formatearDuracion(minutosDecimal) {
    if (minutosDecimal === null || isNaN(minutosDecimal)) return "--";
    const minutos = Math.floor(minutosDecimal);
    const segundos = Math.round((minutosDecimal - minutos) * 60);
    return `${minutos}m ${segundos}s`;
}

function formatearDesviacion(minutosDecimal) {
    if (minutosDecimal === null || isNaN(minutosDecimal) || minutosDecimal <= 0) return "";
    const minutos = Math.floor(minutosDecimal);
    const segundos = Math.round((minutosDecimal - minutos) * 60);
    if (minutos === 0) return `±${segundos}s`;
    return `±${minutos}m ${segundos}s`;
}

function formatearEstadisticaDuracion(stats) {
    if (!stats || stats.promedio === null) return "--";
    const promTexto = formatearDuracion(stats.promedio);
    const desvTexto = stats.desviacion > 0 ? ` (${formatearDesviacion(stats.desviacion)})` : "";
    return `${promTexto}${desvTexto}`;
}

// ==========================================
// HELPERS
// ==========================================

function mostrarN(id, n) {
    const el = document.getElementById(id);
    if (el) el.textContent = `n = ${n}`;
}

function parseMultiple(valor) {
    if (!valor) return [];
    if (Array.isArray(valor)) return valor;
    return String(valor).trim().split(/\s+/);
}

function obtenerFechaDia(encuesta) {
    const start = campo(encuesta, "start");
    const submission = encuesta._submission_time;
    const fechaStr = start || submission;
    if (!fechaStr) return null;
    const fecha = new Date(fechaStr);
    if (isNaN(fecha)) return null;
    return fecha.toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
}

function hoyEcuador() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
}

function ayerEcuador() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
}

function contarDelta(encuestas, prefix) {
    const ayer = encuestas.filter(e => obtenerFechaDia(e) === ayerEcuador()).length;
    const hoy = encuestas.filter(e => obtenerFechaDia(e) === hoyEcuador()).length;
    const diff = hoy - ayer;
    const texto = diff > 0 ? `<span>↑ +${diff}</span>` : diff < 0 ? `<span>↓ ${diff}</span>` : "→ sin cambio";
    const clase = diff > 0 ? "subir" : diff < 0 ? "bajar" : "igual";
    return { ayer, texto, clase, ayerAbs: ayer };
}

function dibujarSparkline(encuestas, canvasId, colorVar) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (!encuestas.length) return;

    const porDia = {};
    encuestas.forEach(e => {
        const dia = obtenerFechaDia(e);
        if (!dia) return;
        porDia[dia] = (porDia[dia] || 0) + 1;
    });
    const dias = Object.keys(porDia).sort();
    if (dias.length < 2) return;
    const ultimos = dias.slice(-8);
    const valores = ultimos.map(d => porDia[d]);
    const max = Math.max(...valores, 1);
    const min = Math.min(...valores);
    const rango = Math.max(max - min, 1);

    const color = getComputedStyle(document.body).getPropertyValue(colorVar).trim() || "#454a91";
    const px = 4, py = 4;
    const aw = w - px * 2, ah = h - py * 2;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    valores.forEach((v, i) => {
        const x = px + (aw * i) / Math.max(valores.length - 1, 1);
        const y = py + ah - ((v - min) / rango) * ah;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const last = valores.length - 1;
    const lx = px + (aw * last) / Math.max(last, 1);
    const ly = py + ah - ((valores[last] - min) / rango) * ah;
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(lx, ly, 2.3, 0, Math.PI * 2);
    ctx.fill();
}

function renderizarFranjaCierre(encuestas, metaTotal, diasActivos) {
    const franja = document.getElementById("franjaCierre");
    if (!franja) return;

    const fechaCierre = /^\d{4}-\d{2}-\d{2}$/.test(FECHA_CIERRE)
        ? FECHA_CIERRE
        : "2026-09-19";
    const diaHoy = Date.parse(`${hoyEcuador()}T00:00:00Z`);
    const diaCierre = Date.parse(`${fechaCierre}T00:00:00Z`);
    const diasRestantes = Number.isNaN(diaCierre) || Number.isNaN(diaHoy)
        ? 0
        : Math.max(0, Math.ceil((diaCierre - diaHoy) / 86400000));
    const restantes = Math.max(0, metaTotal - encuestas.length);
    const ritmoActual = diasActivos > 0 ? encuestas.length / diasActivos : 0;
    const ritmoNecesario = diasRestantes > 0 ? Math.ceil(restantes / diasRestantes) : 0;
    const diferenciaRitmo = ritmoNecesario - Math.floor(ritmoActual);

    let clase = "atrasado";
    let estado = diferenciaRitmo > 0 ? `Acelerar +${diferenciaRitmo}/día` : "En ritmo";
    if (restantes === 0) {
        clase = "en-ritmo";
        estado = "Meta total cumplida";
    } else if (diasRestantes === 0) {
        clase = "vencido";
        estado = "Plazo vencido";
    } else if (ritmoActual >= ritmoNecesario) {
        clase = "en-ritmo";
        estado = "En ritmo";
    }

    const fechaVisible = new Date(`${fechaCierre}T00:00:00Z`).toLocaleDateString("es-EC", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC"
    });

    franja.className = `franja-cierre ${clase}`;
    franja.innerHTML = `
        <span class="franja-cierre-item">
            <span class="franja-cierre-icono" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>
            </span>
            <span>Cierre <strong>${fechaVisible}</strong></span>
        </span>
        <span class="franja-cierre-item">
            <span class="franja-cierre-icono" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </span>
            <span>Faltan <strong>${diasRestantes}</strong> días</span>
        </span>
        <span class="franja-cierre-item">
            <span class="franja-cierre-icono" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </span>
            <span>Ritmo actual <strong>${Math.round(ritmoActual)}/día</strong></span>
        </span>
        <span class="franja-cierre-item">
            <span class="franja-cierre-icono" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
            </span>
            <span>Necesarias <strong>${diasRestantes > 0 ? ritmoNecesario : "—"}/día</strong></span>
        </span>
        <span class="franja-cierre-item franja-cierre-estado">${estado}</span>
    `;
}

function ajustarAlturaLienzo(idCanvas, cantidadCategorias, filaPx = 34, extraPx = 46, minPx = 160) {
    const canvas = document.getElementById(idCanvas);
    if (!canvas) return;
    const contenedor = canvas.parentElement;
    if (!contenedor) return;
    contenedor.style.height = Math.max(minPx, cantidadCategorias * filaPx + extraPx) + "px";
}

function animarNumero(idElemento, valorNuevo, sufijo = "") {
    const elemento = document.getElementById(idElemento);
    if (!elemento) return;
    const valorViejo = parseFloat(elemento.textContent) || 0;
    const esEntero = Number.isInteger(valorNuevo);
    const duracionMs = 600;
    const inicio = performance.now();
    function paso(ahora) {
        const progreso = Math.min((ahora - inicio) / duracionMs, 1);
        const valorActual = valorViejo + (valorNuevo - valorViejo) * progreso;
        elemento.textContent = (esEntero ? Math.round(valorActual) : valorActual.toFixed(1)) + sufijo;
        if (progreso < 1) requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
}

function setBarra(idBarra, valor, meta) {
    const el = document.getElementById(idBarra);
    if (!el) return;
    const pct = meta > 0 ? Math.min(100, (valor / meta) * 100) : 0;
    el.style.width = pct + "%";
}

// Estado vacío para un gráfico
function vaciarLienzo(idCanvas) {
    const canvas = document.getElementById(idCanvas);
    const contenedor = canvas ? canvas.parentElement : null;
    if (!contenedor) return;
    let vacio = contenedor.querySelector(".lienzo-vacio");
    if (!vacio) {
        vacio = document.createElement("div");
        vacio.className = "lienzo-vacio";
        vacio.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>
            </svg>
        `;
        const mensaje = document.createElement("span");
        mensaje.textContent = contenedor.dataset.vacio || "Sin datos";
        vacio.appendChild(mensaje);
        contenedor.appendChild(vacio);
    }
}

function limpiarVacio(idCanvas) {
    const canvas = document.getElementById(idCanvas);
    const contenedor = canvas ? canvas.parentElement : null;
    if (!contenedor) return;
    const vacio = contenedor.querySelector(".lienzo-vacio");
    if (vacio) vacio.remove();
}

function destruirChart(claveGlobal) {
    if (window[claveGlobal]) {
        window[claveGlobal].destroy();
        window[claveGlobal] = null;
    }
}

// ==========================================
// PLUGIN: frecuencia + % al final de barras horizontales
// Muestra primero la frecuencia (n) porque es lo más útil al comparar.
// ==========================================

const pluginEtiquetaPorcentaje = {
    id: "etiquetaPorcentaje",
    afterDatasetsDraw(chart) {
        const { ctx, chartArea } = chart;
        const meta = chart.getDatasetMeta(0);
        if (!meta) return;
        const conteos = chart.data.datasets[0].counts;
        ctx.save();
        ctx.font = "600 11.5px " + getComputedStyle(document.body).fontFamily;
        ctx.textBaseline = "middle";
        meta.data.forEach((barra, i) => {
            const valor = chart.data.datasets[0].data[i];
            const n = conteos ? conteos[i] : null;
            const texto = n !== null ? `${n} (${valor}%)` : `${valor}%`;
            const anchoTexto = ctx.measureText(texto).width;
            const cabeEnAfuera = (barra.x + 8 + anchoTexto) < chartArea.right;
            if (cabeEnAfuera) {
                ctx.fillStyle = esModoOscuro() ? "#f2ecdf" : "#241e15";
                ctx.textAlign = "left";
                ctx.fillText(texto, barra.x + 8, barra.y);
            } else {
                ctx.fillStyle = "#ffffff";
                ctx.textAlign = "right";
                ctx.fillText(texto, barra.x - 8, barra.y);
            }
        });
        ctx.restore();
    }
};

// ==========================================
// PLUGIN: número encima de barras verticales
// ==========================================

const pluginEtiquetaValor = {
    id: "etiquetaValor",
    afterDatasetsDraw(chart) {
        const { ctx } = chart;
        ctx.save();
        ctx.font = "600 10.5px " + getComputedStyle(document.body).fontFamily;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        chart.data.datasets.forEach((ds, dsIdx) => {
            const meta = chart.getDatasetMeta(dsIdx);
            if (!meta || !meta.data) return;
            const color = (typeof ds.backgroundColor === "string")
                ? ds.backgroundColor
                : COLOR_TITULO();
            ctx.fillStyle = color;
            meta.data.forEach((barra, i) => {
                const valor = ds.data[i];
                if (valor === 0 || valor == null) return;
                ctx.fillText(valor, barra.x, barra.y - 4);
            });
        });
        ctx.restore();
    }
};

// ==========================================
// GRÁFICO: AVANCE POR DÍA (barras agrupadas)
// ==========================================

let chartAvanceDia = null;

function generarGraficoAvanceDia(trabajadores, graduados) {
    const diasMap = {};
    const todos = [...trabajadores, ...graduados];
    todos.forEach(e => {
        const dia = obtenerFechaDia(e);
        if (!dia) return;
        if (!diasMap[dia]) diasMap[dia] = { trabajadores: 0, graduados: 0 };
        if (trabajadores.includes(e)) diasMap[dia].trabajadores++;
        else if (graduados.includes(e)) diasMap[dia].graduados++;
    });

    const dias = Object.keys(diasMap).sort();

    if (chartAvanceDia) chartAvanceDia.destroy();

    if (dias.length === 0) {
        chartAvanceDia = null;
        vaciarLienzo("graficoAvanceDia");
        return;
    }
    limpiarVacio("graficoAvanceDia");

    // Si hay muchos días, agrupar por semana para legibilidad
    let etiquetas = dias.map(d => {
        const [anio, mes, diaNum] = d.split("-");
        return `${diaNum}/${mes}`;
    });
    let trabajadoresPorDia = dias.map(d => diasMap[d].trabajadores);
    let graduadosPorDia = dias.map(d => diasMap[d].graduados);

    if (dias.length > 45) {
        const semanal = {};
        dias.forEach(d => {
            const fecha = new Date(d + "T12:00:00");
            const semana = `${fecha.getFullYear()}-S${Math.ceil((fecha.getDate() + ((fecha.getDay() + 6) % 7)) / 7)}-${fecha.getMonth() + 1}`;
            if (!semanal[semana]) semanal[semana] = { trabajadores: 0, graduados: 0, fecha };
            semanal[semana].trabajadores += diasMap[d].trabajadores;
            semanal[semana].graduados += diasMap[d].graduados;
        });
        const claves = Object.keys(semanal).sort((a, b) => semanal[a].fecha - semanal[b].fecha);
        etiquetas = claves.map(c => {
            const f = semanal[c].fecha;
            return `S${Math.ceil((f.getDate() + ((f.getDay() + 6) % 7)) / 7)}/${f.getMonth() + 1}`;
        });
        trabajadoresPorDia = claves.map(c => semanal[c].trabajadores);
        graduadosPorDia = claves.map(c => semanal[c].graduados);
    }

    const colorTrabajadores = cssVar("--kimi-chart-4");
    const colorGraduados = cssVar("--kimi-chart-6");

    const leyenda = document.getElementById("leyendaAvanceDia");
    if (leyenda) {
        leyenda.innerHTML = `
            <span class="leyenda-pildora" style="--pill-color: var(--kimi-chart-4)">Trabajadores</span>
            <span class="leyenda-pildora" style="--pill-color: var(--kimi-chart-6)">Graduados</span>
        `;
    }

    chartAvanceDia = new Chart(document.getElementById("graficoAvanceDia"), {
        type: "bar",
        plugins: [pluginEtiquetaValor],
        data: {
            labels: etiquetas,
            datasets: [
                {
                    label: "Trabajadores",
                    data: trabajadoresPorDia,
                    backgroundColor: colorTrabajadores,
                    borderRadius: 5,
                    barPercentage: 0.35,
                    categoryPercentage: 0.75
                },
                {
                    label: "Graduados",
                    data: graduadosPorDia,
                    backgroundColor: colorGraduados,
                    borderRadius: 5,
                    barPercentage: 0.35,
                    categoryPercentage: 0.75
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600, easing: "easeOutQuart" },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y} encuestas`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: COLOR_TEXTO(), precision: 0 },
                    grid: { color: COLOR_GRID() }
                },
                x: {
                    ticks: { color: COLOR_TEXTO(), maxRotation: 45, minRotation: 0 },
                    grid: { display: false }
                }
            }
        }
    });
}

// ==========================================
// GRÁFICO: PROVINCIA (barras horizontales)
// ==========================================

let chartProvincia = null;

function generarGraficoProvincia(encuestas) {
    const modoMeta = filtroActual !== "graduados";
    const conteo = {};
    let respondio = 0;
    encuestas.forEach(e => {
        const valor = campo(e, "provincia");
        if (!valor || !MAPA_PROVINCIA[valor]) return;
        respondio++;
        conteo[valor] = (conteo[valor] || 0) + 1;
    });

    let filas;
    let filasSinMeta = [];
    const nProvincia = document.getElementById("nProvincia");
    if (nProvincia) nProvincia.textContent = `n = ${respondio} con provincia`;
    if (modoMeta) {
        filas = Object.entries(META_PROVINCIA)
            .map(([codigo, meta]) => {
                const count = conteo[codigo] || 0;
                return {
                    label: MAPA_PROVINCIA[codigo],
                    meta,
                    count,
                    valor: meta > 0 ? Number(((count / meta) * 100).toFixed(1)) : 0
                };
            })
            .sort((a, b) => b.valor - a.valor || b.count - a.count);
        filasSinMeta = Object.entries(conteo)
            .filter(([codigo]) => !META_PROVINCIA[codigo])
            .map(([codigo, count]) => ({
                label: MAPA_PROVINCIA[codigo],
                count
            }))
            .sort((a, b) => b.count - a.count);
        const titulo = document.getElementById("tituloProvincia");
        if (titulo) titulo.textContent = "Avance vs meta";
        mostrarPanelProvincia(filas, filasSinMeta);
        return;
    } else {
        ocultarPanelProvincia();
        filas = Object.entries(conteo)
            .sort((a, b) => b[1] - a[1])
            .map(([codigo, count]) => ({
                label: MAPA_PROVINCIA[codigo],
                count,
                valor: respondio > 0 ? Number(((count / respondio) * 100).toFixed(1)) : 0
            }));
        const titulo = document.getElementById("tituloProvincia");
        if (titulo) titulo.textContent = "Distribución por provincia";
    }

    if (chartProvincia) chartProvincia.destroy();

    if (!filas.length) {
        chartProvincia = null;
        vaciarLienzo("graficoProvincia");
        return;
    }
    limpiarVacio("graficoProvincia");

    const etiquetas = filas.map(d => d.label);
    const valores = filas.map(d => d.valor);
    const counts = filas.map(d => d.count);
    ajustarAlturaLienzo("graficoProvincia", etiquetas.length, 32, 20, 200);

    chartProvincia = new Chart(document.getElementById("graficoProvincia"), {
        type: "bar",
        data: {
            labels: etiquetas,
            datasets: [{
                data: valores,
                counts: counts,
                backgroundColor: cssVar("--kimi-chart-1"),
                borderRadius: 5,
                maxBarThickness: 22,
                barPercentage: 0.7,
                categoryPercentage: 0.85
            }]
        },
        plugins: [pluginEtiquetaPorcentaje],
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600, easing: "easeOutQuart" },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.parsed.x}% (${filas[ctx.dataIndex].count} respuestas)`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true, max: 100,
                    ticks: { color: COLOR_TEXTO(), callback: v => v + "%" },
                    grid: { color: COLOR_GRID() }
                },
                y: {
                    ticks: { color: COLOR_TEXTO(), font: { size: 11 }, autoSkip: false },
                    grid: { display: false }
                }
            }
        }
    });
}

function claseEstadoProvincia(pct) {
    if (pct >= 100) return "estado-cumplida";
    if (pct >= 75) return "estado-alto";
    if (pct >= 50) return "estado-medio";
    if (pct >= 25) return "estado-bajo";
    return "estado-muy-bajo";
}

function mostrarPanelProvincia(filasMeta, filasSinMeta) {
    const lienzo = document.getElementById("lienzoProvincia");
    const panel = document.getElementById("panelProvincia");
    if (!lienzo || !panel) return;

    if (chartProvincia) {
        chartProvincia.destroy();
        chartProvincia = null;
    }

    lienzo.style.display = "none";
    panel.hidden = false;
    const formatearNumero = valor => Number(valor).toLocaleString("es-EC");

    const tarjetasMeta = filasMeta.map(fila => {
        const porcentaje = Number(fila.valor.toFixed(1));
        const avanceBarra = Math.min(100, Math.max(0, porcentaje));
        const diferencia = fila.meta - fila.count;
        const estado = diferencia > 0
            ? `Faltan ${formatearNumero(diferencia)}`
            : diferencia === 0
                ? "Meta alcanzada"
                : `Supera por ${formatearNumero(Math.abs(diferencia))}`;
        return `
            <article class="provincia-meta-fila ${claseEstadoProvincia(porcentaje)}" role="listitem" aria-label="${fila.label}: ${fila.count} encuestas, ${porcentaje}% de meta, objetivo ${fila.meta}">
                <div class="provincia-meta-cabecera">
                    <span class="provincia-meta-nombre" title="${fila.label}">${fila.label}</span>
                    <strong class="provincia-meta-porcentaje">${porcentaje}%</strong>
                    <span class="provincia-meta-objetivo">Meta: ${formatearNumero(fila.meta)}</span>
                </div>
                <div class="provincia-meta-track" aria-hidden="true">
                    <span class="provincia-meta-relleno" style="--provincia-avance: ${avanceBarra}%"></span>
                </div>
                <div class="provincia-meta-detalle">
                    <span><strong>${formatearNumero(fila.count)} encuestas</strong> · ${porcentaje}% de meta</span>
                    <span>${estado}</span>
                </div>
            </article>`;
    }).join("");

    const totalSinMeta = filasSinMeta.reduce((s, fila) => s + fila.count, 0);
    const chips = filasSinMeta.map(fila => `
        <span class="provincia-sin-meta-chip" role="listitem" aria-label="${fila.label}: ${fila.count} encuestas, sin meta">
            <span title="${fila.label}">${fila.label}</span>
            <strong>${formatearNumero(fila.count)} encuestas</strong>
        </span>`).join("");

    panel.innerHTML = `
        <div class="provincia-meta-lista" role="list" aria-label="Avance por meta individual">${tarjetasMeta}</div>
        ${filasSinMeta.length ? `
            <div class="provincia-sin-meta-cabecera">
                <span>Sin meta asignada</span>
                <small>${formatearNumero(totalSinMeta)} encuestas sin meta · solo referencia</small>
            </div>
            <div class="provincia-sin-meta-lista" role="list">${chips}</div>` : ""}
    `;
}

function ocultarPanelProvincia() {
    const lienzo = document.getElementById("lienzoProvincia");
    const panel = document.getElementById("panelProvincia");
    if (!lienzo || !panel) return;
    panel.hidden = true;
    panel.innerHTML = "";
    lienzo.style.display = "";
}

// ==========================================
// GRÁFICO: GÉNERO (barras horizontales con iconos)
// Femenino rosa, Masculino azul, No binario violeta, Prefiere no responder arena.
// ==========================================

const PALETA_GENERO_CLARO = ["#d4557f", "#4f7fc4", "#8a5fc4", "#b08a4a"];
const PALETA_GENERO_OSCURO = ["#e57498", "#6f9ad6", "#9f77d6", "#c9a35a"];
const ICONO_GENERO = { "1": "♀", "2": "♂", "3": "⚧", "0": "?" };
const ORDEN_GENERO = ["1", "2", "3", "0"];

function colorGenero(codigo) {
    const pal = esModoOscuro() ? PALETA_GENERO_OSCURO : PALETA_GENERO_CLARO;
    return pal[Math.max(0, ORDEN_GENERO.indexOf(codigo)) % pal.length];
}

let chartGenero = null;

function generarGraficoGenero(encuestas) {
    const conteo = {};
    let respondio = 0;
    encuestas.forEach(e => {
        const valor = campo(e, "p5");
        if (!valor || !MAPA_GENERO[valor]) return;
        respondio++;
        conteo[valor] = (conteo[valor] || 0) + 1;
    });

    mostrarN("nGenero", respondio);

    if (chartGenero) chartGenero.destroy();

    // Ordenar de mayor a menor frecuencia
    const items = ORDEN_GENERO
        .filter(c => conteo[c])
        .map(c => ({
            codigo: c,
            etiqueta: MAPA_GENERO[c],
            count: conteo[c]
        }))
        .sort((a, b) => b.count - a.count);

    if (items.length === 0) {
        chartGenero = null;
        vaciarLienzo("graficoGenero");
        return;
    }
    limpiarVacio("graficoGenero");

    const totalGeneral = items.reduce((s, it) => s + it.count, 0);
    const etiquetas = items.map(it => `${ICONO_GENERO[it.codigo]} ${it.etiqueta}`);
    const valores = items.map(it => Number(((it.count / totalGeneral) * 100).toFixed(1)));
    const counts = items.map(it => it.count);
    const colores = items.map(it => colorGenero(it.codigo));

    ajustarAlturaLienzo("graficoGenero", etiquetas.length, 34, 20, 200);

    chartGenero = new Chart(document.getElementById("graficoGenero"), {
        type: "bar",
        data: {
            labels: etiquetas,
            datasets: [{
                data: valores,
                counts: counts,
                backgroundColor: colores,
                borderRadius: 5,
                maxBarThickness: 26,
                barPercentage: 0.7,
                categoryPercentage: 0.85
            }]
        },
        plugins: [pluginEtiquetaPorcentaje],
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600, easing: "easeOutQuart" },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `${counts[ctx.dataIndex]} respuestas (${ctx.parsed.x}%)`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true, max: 100,
                    ticks: { color: COLOR_TEXTO(), callback: v => v + "%" },
                    grid: { color: COLOR_GRID() }
                },
                y: {
                    ticks: { color: COLOR_TEXTO(), font: { size: 12 }, autoSkip: false },
                    grid: { display: false }
                }
            }
        }
    });
}

// ==========================================
// GRÁFICO: PRINCIPAL ACTIVIDAD (barras horizontales)
// ==========================================

let chartActividad = null;

function generarGraficoActividad(encuestas) {
    const conteo = {};
    encuestas.forEach(e => {
        const valor = campo(e, "p13");
        if (!valor) return;
        const bucket = MAPA_ACTIVIDAD_BUCKET[valor] || "Otras";
        conteo[bucket] = (conteo[bucket] || 0) + 1;
    });

    const totalGeneral = Object.values(conteo).reduce((a, b) => a + b, 0);
    mostrarN("nActividad", totalGeneral);
    document.getElementById("donaTotalActividad").innerHTML =
        `<strong>${totalGeneral}</strong> respuestas registradas`;

    const ordenados = ORDEN_ACTIVIDAD
        .filter(cat => conteo[cat])
        .map(cat => ({
            label: cat,
            count: conteo[cat],
            valor: totalGeneral > 0 ? Number(((conteo[cat] / totalGeneral) * 100).toFixed(1)) : 0
        }))
        .sort((a, b) => b.count - a.count);

    if (chartActividad) chartActividad.destroy();

    if (ordenados.length === 0) {
        chartActividad = null;
        vaciarLienzo("graficoActividad");
        return;
    }
    limpiarVacio("graficoActividad");

    const etiquetas = ordenados.map(d => d.label);
    const valores = ordenados.map(d => d.valor);
    const counts = ordenados.map(d => d.count);
    const colores = ordenados.map(d => {
        const varName = COLORES_ACTIVIDAD[d.label];
        return varName.startsWith("var(") ? cssVar(varName.slice(4, -1)) : varName;
    });

    ajustarAlturaLienzo("graficoActividad", etiquetas.length, 34, 20, 200);

    chartActividad = new Chart(document.getElementById("graficoActividad"), {
        type: "bar",
        data: {
            labels: etiquetas,
            datasets: [{
                data: valores,
                counts: counts,
                backgroundColor: colores,
                borderRadius: 5,
                maxBarThickness: 26,
                barPercentage: 0.7,
                categoryPercentage: 0.85
            }]
        },
        plugins: [pluginEtiquetaPorcentaje],
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600, easing: "easeOutQuart" },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.parsed.x}% (${counts[ctx.dataIndex]} respuestas)`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true, max: 100,
                    ticks: { color: COLOR_TEXTO(), callback: v => v + "%" },
                    grid: { color: COLOR_GRID() }
                },
                y: {
                    ticks: { color: COLOR_TEXTO(), font: { size: 12 }, autoSkip: false },
                    grid: { display: false }
                }
            }
        }
    });
}

// ==========================================
// GRÁFICO: AÑO DE GRADUACIÓN (barras verticales)
// ==========================================

let chartAnioGraduacion = null;

function generarGraficoAnioGraduacion(graduados) {
    const conteo = {};
    let respondio = 0;
    graduados.forEach(e => {
        const valor = campo(e, "p5u");
        if (!valor || isNaN(Number(valor))) return;
        respondio++;
        conteo[valor] = (conteo[valor] || 0) + 1;
    });

    mostrarN("nAnioGraduacion", respondio);

    const anos = Object.keys(conteo).sort((a, b) => Number(a) - Number(b));
    const valores = anos.map(a => conteo[a]);

    if (chartAnioGraduacion) chartAnioGraduacion.destroy();

    if (anos.length === 0) {
        chartAnioGraduacion = null;
        vaciarLienzo("graficoAnioGraduacion");
        return;
    }
    limpiarVacio("graficoAnioGraduacion");

    chartAnioGraduacion = new Chart(document.getElementById("graficoAnioGraduacion"), {
        type: "bar",
        data: {
            labels: anos,
            datasets: [{
                data: valores,
                backgroundColor: cssVar("--kimi-chart-3"),
                borderRadius: 6,
                barThickness: 40,
                categoryPercentage: 0.9,
                barPercentage: 0.8
            }]
        },
        plugins: [pluginEtiquetaValor],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 20 } },
            animation: { duration: 600, easing: "easeOutQuart" },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = total > 0 ? ((ctx.parsed.y / total) * 100).toFixed(1) : 0;
                            return `${ctx.parsed.y} graduados (${pct}%)`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: COLOR_TEXTO(), precision: 0 },
                    grid: { color: COLOR_GRID() }
                },
                x: {
                    ticks: { color: COLOR_TEXTO() },
                    grid: { display: false }
                }
            }
        }
    });
}

// ==========================================
// GRÁFICO: TÍTULO OBTENIDO (barras horizontales)
// ==========================================

let chartTitulo = null;

function generarGraficoTitulo(graduados) {
    const conteo = {};
    let respondio = 0;
    graduados.forEach(e => {
        const valor = campo(e, "p6u");
        if (!valor) return;
        respondio++;
        const selecciones = parseMultiple(valor);
        selecciones.forEach(s => {
            if (MAPA_TITULO[s]) {
                conteo[s] = (conteo[s] || 0) + 1;
            }
        });
    });

    mostrarN("nTitulo", respondio);

    const ordenados = Object.entries(conteo)
        .sort((a, b) => b[1] - a[1])
        .map(([codigo, count]) => ({
            label: MAPA_TITULO[codigo],
            valor: respondio > 0 ? Number(((count / respondio) * 100).toFixed(1)) : 0,
            count
        }));

    if (chartTitulo) chartTitulo.destroy();

    if (ordenados.length === 0) {
        chartTitulo = null;
        vaciarLienzo("graficoTitulo");
        return;
    }
    limpiarVacio("graficoTitulo");

    const etiquetas = ordenados.map(d => d.label);
    const valores = ordenados.map(d => d.valor);
    const counts = ordenados.map(d => d.count);

    ajustarAlturaLienzo("graficoTitulo", etiquetas.length, 34, 20, 200);

    chartTitulo = new Chart(document.getElementById("graficoTitulo"), {
        type: "bar",
        data: {
            labels: etiquetas,
            datasets: [{
                data: valores,
                counts: counts,
                backgroundColor: cssVar("--kimi-chart-3"),
                borderRadius: 5,
                maxBarThickness: 26,
                barPercentage: 0.7,
                categoryPercentage: 0.85
            }]
        },
        plugins: [pluginEtiquetaPorcentaje],
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600, easing: "easeOutQuart" },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.parsed.x}% (${ordenados[ctx.dataIndex].count} respuestas)`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true, max: 100,
                    ticks: { color: COLOR_TEXTO(), callback: v => v + "%" },
                    grid: { color: COLOR_GRID() }
                },
                y: {
                    ticks: { color: COLOR_TEXTO(), font: { size: 11 }, autoSkip: false },
                    grid: { display: false }
                }
            }
        }
    });
}

// ==========================================
// GRÁFICO: MEDIO DE ENCUESTA (barras horizontales)
// ==========================================

let chartMedio = null;

function generarGraficoMedio(encuestas) {
    const conteo = {};
    let respondio = 0;
    encuestas.forEach(e => {
        const valor = campo(e, "monitoreo");
        if (!valor || !MAPA_MEDIO[valor]) return;
        respondio++;
        conteo[valor] = (conteo[valor] || 0) + 1;
    });

    mostrarN("nMedio", respondio);

    if (chartMedio) chartMedio.destroy();

    if (respondio === 0) {
        chartMedio = null;
        vaciarLienzo("graficoMedio");
        return;
    }
    limpiarVacio("graficoMedio");

    const etiquetas = Object.keys(MAPA_MEDIO).map(c => MAPA_MEDIO[c]);
    const counts = Object.keys(MAPA_MEDIO).map(c => conteo[c] || 0);
    const valores = Object.keys(MAPA_MEDIO).map(c =>
        respondio > 0 ? Number((((conteo[c] || 0) / respondio) * 100).toFixed(1)) : 0
    );

    ajustarAlturaLienzo("graficoMedio", etiquetas.length, 34, 20, 160);

    chartMedio = new Chart(document.getElementById("graficoMedio"), {
        type: "bar",
        data: {
            labels: etiquetas,
            datasets: [{
                data: valores,
                counts: counts,
                backgroundColor: cssVar("--kimi-chart-4"),
                borderRadius: 5,
                maxBarThickness: 26,
                barPercentage: 0.7,
                categoryPercentage: 0.85
            }]
        },
        plugins: [pluginEtiquetaPorcentaje],
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600, easing: "easeOutQuart" },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.parsed.x}% (${counts[ctx.dataIndex]} respuestas)`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true, max: 100,
                    ticks: { color: COLOR_TEXTO(), callback: v => v + "%" },
                    grid: { color: COLOR_GRID() }
                },
                y: {
                    ticks: { color: COLOR_TEXTO(), font: { size: 12 }, autoSkip: false },
                    grid: { display: false }
                }
            }
        }
    });
}

// ==========================================
// GRÁFICO: MEDIO DE CAPTURA POR DÍA (barras apiladas)
// ==========================================

let chartMedioPorDia = null;

const COLORES_MEDIO = {
    "1": "#4f7fc4", // Link correo (azul)
    "2": "#2f6b45", // Llamada WhatsApp (verde bosque)
    "3": "#d4557f", // Código QR (magenta)
    "4": "#c9862e", // Facilitador (ámbar/dorado)
    "5": "#8a5fc4"  // Redes sociales (violeta)
};

function generarGraficoMedioPorDia(encuestas) {
    const diasMap = {};
    let respondio = 0;

    encuestas.forEach(e => {
        const dia = obtenerFechaDia(e);
        const medio = campo(e, "monitoreo");
        if (!dia || !medio || !MAPA_MEDIO[medio]) return;

        respondio++;
        if (!diasMap[dia]) {
            diasMap[dia] = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, total: 0 };
        }
        diasMap[dia][medio]++;
        diasMap[dia].total++;
    });

    mostrarN("nMedioPorDia", respondio);

    if (chartMedioPorDia) chartMedioPorDia.destroy();

    const dias = Object.keys(diasMap).sort();

    if (dias.length === 0) {
        chartMedioPorDia = null;
        vaciarLienzo("graficoMedioPorDia");
        return;
    }
    limpiarVacio("graficoMedioPorDia");

    // Formato de etiquetas de día dd/mm
    const etiquetas = dias.map(d => {
        const [anio, mes, diaNum] = d.split("-");
        return `${diaNum}/${mes}`;
    });

    const leyenda = document.getElementById("leyendaMedioPorDia");
    if (leyenda) {
        leyenda.innerHTML = Object.entries(MAPA_MEDIO).map(([codigo, nombre]) => `
            <span class="leyenda-pildora" style="--pill-color: ${COLORES_MEDIO[codigo]}">${nombre}</span>
        `).join("");
    }

    const datasets = Object.keys(MAPA_MEDIO).map(codigo => ({
        label: MAPA_MEDIO[codigo],
        data: dias.map(d => diasMap[d][codigo]),
        backgroundColor: COLORES_MEDIO[codigo],
        borderRadius: 2,
        stack: "medios"
    }));

    chartMedioPorDia = new Chart(document.getElementById("graficoMedioPorDia"), {
        type: "bar",
        data: {
            labels: etiquetas,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600, easing: "easeOutQuart" },
            interaction: {
                mode: "index",
                intersect: false
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        footer: items => {
                            const totalDia = items.reduce((s, it) => s + it.parsed.y, 0);
                            return `Total día: ${totalDia} encuestas`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    ticks: { color: COLOR_TEXTO(), maxRotation: 45, minRotation: 0 },
                    grid: { display: false }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: { color: COLOR_TEXTO(), precision: 0 },
                    grid: { color: COLOR_GRID() }
                }
            }
        }
    });
}


// ==========================================
// RESPONSIVE
// ==========================================

let eraMovil = window.innerWidth < QUIEBRE_MOVIL;
let temporizadorResize = null;

window.addEventListener("resize", () => {
    clearTimeout(temporizadorResize);
    temporizadorResize = setTimeout(() => {
        const esMovilAhora = window.innerWidth < QUIEBRE_MOVIL;
        if (esMovilAhora !== eraMovil) {
            eraMovil = esMovilAhora;
            if (ultimosDatosCargados) renderizarTodo();
        }
    }, 250);
});
