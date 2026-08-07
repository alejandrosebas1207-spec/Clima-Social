// ==========================================
// DASHBOARD — Encuesta Artes y Cultura (3ra edición)
// Tabs: Todos / Trabajadores / Graduados UArtes
// Conteo DISJUNTO usando el campo 'grad' como discriminador.
// ==========================================

let META_TRABAJADORES = 2100;
let META_GRADUADOS = 400;
let VALOR_SI = "1";

let filtroActual = "todos";
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

// ==========================================
// RELOJ + FECHA
// ==========================================

function actualizarHora() {
    const ahora = new Date();
    document.getElementById("hora").textContent =
        ahora.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }).replace(/ /g, "\u00A0");
    const fechaEl = document.getElementById("fecha");
    if (fechaEl) {
        fechaEl.textContent = ahora.toLocaleDateString("es-EC", {
            weekday: "long", day: "numeric", month: "long"
        });
    }
}
actualizarHora();
setInterval(actualizarHora, 30000);

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
    // Re-renderiza en el siguiente frame para que el canvas lea
    // los colores ya aplicados por la clase -> modo-oscuro
    requestAnimationFrame(() => {
        if (ultimosDatosCargados) renderizarTodo();
    });
}

// El tablero arranca SIEMPRE en modo claro. La preferencia del usuario
// solo se usa si la guardó antes con el botón.
function inicializarModoOscuro() {
    const activo = localStorage.getItem(CLAVE_MODO) === "1";
    aplicarModoOscuro(activo);
}

const botonModoOscuro = document.getElementById("botonModoOscuro");
if (botonModoOscuro) {
    botonModoOscuro.addEventListener("click", () => {
        const activo = !esModoOscuro();
        localStorage.setItem(CLAVE_MODO, activo ? "1" : "0");
        aplicarModoOscuro(activo);
    });
}

// ==========================================
// CONFIG + DATOS
// ==========================================

async function obtenerConfig() {
    try {
        const respuesta = await fetch("/api/config");
        if (!respuesta.ok) throw new Error("No se pudo obtener configuración");
        const config = await respuesta.json();
        META_TRABAJADORES = Number(config.metaTrabajadores) || 2100;
        META_GRADUADOS = Number(config.metaGraduados) || 400;
        VALOR_SI = config.valorConsentimientoSi || "1";
        document.getElementById("tituloProyecto").textContent = config.nombreProyecto || "Encuesta Artes y Cultura";
        document.title = document.getElementById("tituloProyecto").textContent;
    } catch (error) {
        console.warn("Usando configuración por defecto", error);
    }
}

async function obtenerDatos(silencioso = false) {
    try {
        if (!silencioso) await obtenerConfig();
        const respuesta = await fetch("/api/encuestas");
        if (!respuesta.ok) throw new Error("No fue posible obtener los datos.");
        const datos = await respuesta.json();
        procesarDatos(datos);
        ultimaActualizacionExitos = new Date();
        actualizarTimestamp();
        ocultarCarga();
        ocultarError();
    } catch (error) {
        console.error(error);
        if (!silencioso) {
            ocultarCarga();
            mostrarError();
        }
    }
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
        overlay.setAttribute("aria-hidden", "false");
    }
}

inicializarModoOscuro();
obtenerDatos();

// ==========================================
// PROCESAMIENTO PRINCIPAL — CONTEO DISJUNTO
// ==========================================

function procesarDatos(datos) {
    ultimosDatosCargados = datos;

    const esGraduado = e => campo(e, "grad") === "1" && campo(e, "consentuartes") === VALOR_SI;
    const esTrabajador = e => campo(e, "grad") === "2" && campo(e, "consent") === VALOR_SI;

    const graduados = datos.resultados.filter(esGraduado);
    const trabajadores = datos.resultados.filter(esTrabajador);
    const todos = [...trabajadores, ...graduados];

    ultimosDatosCargados.trabajadores = trabajadores;
    ultimosDatosCargados.graduados = graduados;
    ultimosDatosCargados.todos = todos;

    renderizarTodo();
}

// ==========================================
// RENDERIZAR TODO
// ==========================================

function renderizarTodo() {
    if (!ultimosDatosCargados) return;

    const { trabajadores, graduados, todos } = ultimosDatosCargados;
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
    }
    const avance = metaSegmento > 0 ? ((totalSegmento / metaSegmento) * 100) : 0;
    animarNumero("kpiAvance", Number(avance.toFixed(1)), "%");
    document.getElementById("kpiMeta").textContent = `${totalSegmento} de ${metaSegmento}`;
    setBarra("barraAvance", totalSegmento, metaSegmento);

    // --- Duración promedio (siempre sobre todos) ---
    const duracionProm = calcularDuracionPromedio(todos);
    document.getElementById("kpiDuracion").textContent =
        duracionProm !== null ? formatearDuracion(duracionProm) : "--";

    // --- Elegir conjunto de datos según filtro ---
    let conjunto;
    if (filtroActual === "todos") conjunto = todos;
    else if (filtroActual === "trabajadores") conjunto = trabajadores;
    else if (filtroActual === "graduados") conjunto = graduados;

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

    // --- Visibilidad de gráficos exclusivos de graduados ---
    document.querySelectorAll('[data-segmento="graduados"]').forEach(el => {
        el.classList.toggle("oculto", filtroActual === "trabajadores");
    });

    // --- Mostrar/ocultar badge en gráficos de graduados según filtro ---
    document.querySelectorAll('[data-segmento="graduados"] .badge-segmento').forEach(el => {
        el.style.display = (filtroActual === "todos") ? 'inline-block' : 'none';
    });

    // --- Gráficos siempre visibles ---
    generarGraficoSeguro("generarGraficoAvanceDia", trabajadores, graduados);
    generarGraficoSeguro("generarGraficoMedio", conjunto);
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
// DURACIÓN PROMEDIO
// ==========================================

function calcularDuracionPromedio(registros) {
    let sumaMinutos = 0, contador = 0;
    registros.forEach(encuesta => {
        const inicio = campo(encuesta, "start");
        const fin = campo(encuesta, "end");
        if (!inicio || !fin) return;
        const t1 = new Date(inicio).getTime();
        const t2 = new Date(fin).getTime();
        if (isNaN(t1) || isNaN(t2) || t2 <= t1) return;
        const minutos = (t2 - t1) / 60000;
        if (minutos > 180) return;
        sumaMinutos += minutos;
        contador++;
    });
    return contador === 0 ? null : sumaMinutos / contador;
}

function formatearDuracion(minutosDecimal) {
    const minutos = Math.floor(minutosDecimal);
    const segundos = Math.round((minutosDecimal - minutos) * 60);
    return `${minutos}m ${segundos}s`;
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
// PLUGIN: línea punteada de referencia de meta (100%)
// ==========================================

const pluginLineaMeta = {
    id: "lineaMeta",
    afterDatasetsDraw(chart) {
        if (!chart.options.plugins.lineaMeta || chart.options.plugins.lineaMeta.oculto) return;
        const { ctx, chartArea } = chart;
        const escalaX = chart.scales.x;
        if (!escalaX || escalaX.max <= 100) return;
        const x = escalaX.getPixelForValue(100);
        if (x < chartArea.left || x > chartArea.right) return;
        ctx.save();
        ctx.strokeStyle = esModoOscuro() ? "rgba(242,236,223,0.55)" : "rgba(36,30,21,0.45)";
        ctx.setLineDash([6, 5]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = "600 10px " + getComputedStyle(document.body).fontFamily;
        ctx.fillStyle = ctx.strokeStyle;
        ctx.textAlign = "center";
        ctx.fillText("Meta", x, chartArea.top - 4);
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
        const meta = chart.getDatasetMeta(0);
        if (!meta) return;
        ctx.save();
        ctx.font = "600 12px " + getComputedStyle(document.body).fontFamily;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillStyle = esModoOscuro() ? "#f2ecdf" : "#241e15";
        meta.data.forEach((barra, i) => {
            const valor = chart.data.datasets[0].data[i];
            if (valor === 0) return;
            ctx.fillText(valor, barra.x, barra.y - 6);
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

    const colorTrabajadores = cssVar("--kimi-chart-1");
    const colorGraduados = cssVar("--kimi-chart-3");

    chartAvanceDia = new Chart(document.getElementById("graficoAvanceDia"), {
        type: "bar",
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
                legend: {
                    labels: {
                        color: COLOR_TITULO(),
                        font: { size: 12, weight: "600" },
                        boxWidth: 14,
                        padding: 14,
                        usePointStyle: true
                    }
                },
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
        mostrarN("nProvincia", Object.values(conteo).reduce((s, n) => s + n, 0));
        const titulo = document.getElementById("tituloProvincia");
        if (titulo) titulo.textContent = "Avance vs meta";
        mostrarPanelProvincia(filasSinMeta);
    } else {
        ocultarPanelProvincia();
        filas = Object.entries(conteo)
            .sort((a, b) => b[1] - a[1])
            .map(([codigo, count]) => ({
                label: MAPA_PROVINCIA[codigo],
                count,
                valor: respondio > 0 ? Number(((count / respondio) * 100).toFixed(1)) : 0
            }));
        mostrarN("nProvincia", respondio);
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
    const maxEje = modoMeta
        ? Math.max(110, Math.ceil(Math.max(100, ...valores) / 10) * 10 + 10)
        : 100;
    ajustarAlturaLienzo("graficoProvincia", etiquetas.length, 28, 26, 360);

    chartProvincia = new Chart(document.getElementById("graficoProvincia"), {
        type: "bar",
        data: {
            labels: etiquetas,
            datasets: [{
                data: valores,
                counts: counts,
                metas: filas.map(d => d.meta),
                backgroundColor: modoMeta
                    ? filas.map(d => colorProvincia(d.valor, d.meta))
                    : cssVar("--kimi-chart-1"),
                borderRadius: 5,
                maxBarThickness: 22,
                barPercentage: 0.7,
                categoryPercentage: 0.85
            }]
        },
        plugins: modoMeta
            ? [pluginEtiquetaPorcentaje, pluginLineaMeta]
            : [pluginEtiquetaPorcentaje],
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600, easing: "easeOutQuart" },
            plugins: {
                legend: { display: false },
                lineaMeta: { oculto: !modoMeta },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const fila = filas[ctx.dataIndex];
                            if (!modoMeta) return `${ctx.parsed.x}% (${fila.count} respuestas)`;
                            const faltan = Math.max(0, fila.meta - fila.count);
                            return fila.valor >= 100
                                ? `${fila.count} de ${fila.meta} · ✓ Meta cumplida`
                                : `${fila.count} de ${fila.meta} · faltan ${faltan}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true, max: maxEje,
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

function colorProvincia(pct, meta) {
    if (meta === null) return cssVar("--kimi-chart-1");
    if (pct >= 100) return cssVar("--kimi-chart-3");
    if (pct >= 50) return cssVar("--kimi-chart-4");
    return cssVar("--kimi-chart-2");
}

function mostrarPanelProvincia(filasSinMeta) {
    const panel = document.getElementById("panelProvincia");
    if (!panel) return;
    if (!filasSinMeta.length) {
        panel.hidden = true;
        panel.innerHTML = "";
        return;
    }

    const totalSinMeta = filasSinMeta.reduce((s, fila) => s + fila.count, 0);
    const formatearNumero = valor => Number(valor).toLocaleString("es-EC");
    const chips = filasSinMeta.map(fila => `
        <span class="provincia-sin-meta-chip" role="listitem" aria-label="${fila.label}: ${fila.count} respuestas, sin meta">
            <span title="${fila.label}">${fila.label}</span>
            <strong>${formatearNumero(fila.count)}</strong>
        </span>`).join("");

    panel.hidden = false;
    panel.innerHTML = `
        <div class="provincia-sin-meta-cabecera">
            <span>Sin meta asignada</span>
            <small>${formatearNumero(totalSinMeta)} respuestas · solo referencia</small>
        </div>
        <div class="provincia-sin-meta-lista" role="list">${chips}</div>
    `;
}

function ocultarPanelProvincia() {
    const panel = document.getElementById("panelProvincia");
    if (!panel) return;
    panel.hidden = true;
    panel.innerHTML = "";
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
