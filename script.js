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

const INTERVALO_AUTOREFRESCO = 3 * 60 * 1000;
const QUIEBRE_MOVIL = 700;

function esModoOscuro() {
    return document.body.classList.contains("modo-oscuro");
}

function cssVar(nombre) {
    return getComputedStyle(document.body).getPropertyValue(nombre).trim();
}

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

const MAPA_GENERO = {
    "1": "Femenino", "2": "Masculino", "3": "No binario", "0": "Prefiere no responder"
};

const MAPA_MEDIO = {
    "1": "Link por correo",
    "2": "Llamada telefónica",
    "3": "Código QR",
    "4": "Facilitador"
};

const MAPA_TITULO = {
    "1": "Lic. Artes Visuales",
    "2": "Lic. Artes Musicales",
    "3": "Lic. Creación Teatral",
    "4": "Lic. Cine",
    "5": "Lic. Literatura",
    "6": "Lic. Producción Musical",
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
// RELOJ
// ==========================================

function actualizarHora() {
    const ahora = new Date();
    document.getElementById("hora").textContent =
        ahora.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }).replace(/ /g, "\u00A0");
}
actualizarHora();
setInterval(actualizarHora, 60000);

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
        actualizarTimestamp();
        ocultarCarga();
        ocultarError();
    } catch (error) {
        console.error(error);
        if (!silencioso) { ocultarCarga(); mostrarError(); }
    }
}

function actualizarTimestamp() {
    const el = document.getElementById("ultimaActualizacion");
    if (!el) return;
    const hora = new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
    el.textContent = `Última actualización: ${hora}`;
}

setInterval(() => obtenerDatos(true), INTERVALO_AUTOREFRESCO);

function ocultarCarga() {
    const overlay = document.getElementById("cargaOverlay");
    if (overlay) overlay.classList.add("oculto");
}
function mostrarError() {
    const banner = document.getElementById("errorBanner");
    if (banner) banner.style.display = "block";
}
function ocultarError() {
    const banner = document.getElementById("errorBanner");
    if (banner) banner.style.display = "none";
}
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
    const avance = metaSegmento > 0 ? ((totalSegmento / metaSegmento) * 100).toFixed(1) : 0;
    animarNumero("kpiAvance", Number(avance), "%");
    document.getElementById("kpiMeta").textContent = `${totalSegmento} de ${metaSegmento}`;

    // --- Duración promedio (siempre sobre todos) ---
    const duracionProm = calcularDuracionPromedio(todos);
    document.getElementById("kpiDuracion").textContent =
        duracionProm !== null ? formatearDuracion(duracionProm) : "--";

    // --- Visibilidad de gráficos exclusivos de graduados ---
    document.querySelectorAll('[data-segmento="graduados"]').forEach(el => {
        el.classList.toggle("oculto", filtroActual === "trabajadores");
    });

    // --- Mostrar/ocultar badge en gráficos de graduados según filtro ---
    document.querySelectorAll('[data-segmento="graduados"] .badge-segmento').forEach(el => {
        el.style.display = (filtroActual === "todos") ? 'inline-block' : 'none';
    });

    // --- Elegir conjunto de datos según filtro ---
    let conjunto;
    if (filtroActual === "todos") conjunto = todos;
    else if (filtroActual === "trabajadores") conjunto = trabajadores;
    else if (filtroActual === "graduados") conjunto = graduados;

    // --- Gráficos siempre visibles (Provincia, Género, Actividad, Medio, Avance) ---
    generarGraficoAvanceDia(trabajadores, graduados);
    generarGraficoMedio(conjunto);
    generarGraficoProvincia(conjunto);
    generarGraficoGenero(conjunto);
    generarGraficoActividad(conjunto);

    // --- Gráficos exclusivos de graduados ---
    if (filtroActual !== "trabajadores") {
        generarGraficoAnioGraduacion(graduados);
        generarGraficoTitulo(graduados);
    } else {
        if (chartAnioGraduacion) { chartAnioGraduacion.destroy(); chartAnioGraduacion = null; }
        if (chartTitulo) { chartTitulo.destroy(); chartTitulo = null; }
        mostrarN("nAnioGraduacion", 0);
        mostrarN("nTitulo", 0);
    }
}

// ==========================================
// TABS
// ==========================================

document.querySelectorAll(".tab").forEach(boton => {
    boton.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(b => b.classList.remove("activo"));
        boton.classList.add("activo");
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
    return fecha.toISOString().split("T")[0];
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

// ==========================================
// PLUGIN: % al final de barras horizontales
// ==========================================

const pluginEtiquetaPorcentaje = {
    id: "etiquetaPorcentaje",
    afterDatasetsDraw(chart) {
        const { ctx, chartArea } = chart;
        const meta = chart.getDatasetMeta(0);
        if (!meta) return;
        ctx.save();
        ctx.font = "600 12px " + getComputedStyle(document.body).fontFamily;
        ctx.textBaseline = "middle";
        meta.data.forEach((barra, i) => {
            const valor = chart.data.datasets[0].data[i];
            const texto = `${valor}%`;
            const anchoTexto = ctx.measureText(texto).width;
            const cabeEnAfuera = (barra.x + 8 + anchoTexto) < chartArea.right;
            if (cabeEnAfuera) {
                ctx.fillStyle = esModoOscuro() ? "#f3ede2" : "#2b241c";
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
// GRÁFICO: AVANCE POR DÍA (barras agrupadas SIN línea)
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
    if (dias.length === 0) {
        if (chartAvanceDia) { chartAvanceDia.destroy(); chartAvanceDia = null; }
        return;
    }

    const trabajadoresPorDia = dias.map(d => diasMap[d].trabajadores);
    const graduadosPorDia = dias.map(d => diasMap[d].graduados);

    const colorTexto = esModoOscuro() ? "#b3a695" : "#75695a";
    const colorGrid = esModoOscuro() ? "#3c3226" : "#e6ded2";
    const colorTrabajadores = cssVar("--kimi-chart-1");
    const colorGraduados = cssVar("--kimi-chart-3");

    if (chartAvanceDia) chartAvanceDia.destroy();

    chartAvanceDia = new Chart(document.getElementById("graficoAvanceDia"), {
        type: "bar",
        data: {
            labels: dias.map(d => {
                const [anio, mes, diaNum] = d.split("-");
                return `${diaNum}/${mes}`;
            }),
            datasets: [
                {
                    label: "Trabajadores",
                    data: trabajadoresPorDia,
                    backgroundColor: colorTrabajadores,
                    borderRadius: 4,
                    barPercentage: 0.4,
                    categoryPercentage: 0.8
                },
                {
                    label: "Graduados",
                    data: graduadosPorDia,
                    backgroundColor: colorGraduados,
                    borderRadius: 4,
                    barPercentage: 0.4,
                    categoryPercentage: 0.8
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
                        color: esModoOscuro() ? "#f3ede2" : "#2b241c",
                        font: { size: 12, weight: "600" },
                        boxWidth: 14,
                        padding: 12
                    }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const label = ctx.dataset.label || '';
                            const val = ctx.parsed.y;
                            return `${label}: ${val} encuestas`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: colorTexto },
                    grid: { color: colorGrid }
                },
                x: {
                    ticks: { color: colorTexto, maxRotation: 45, minRotation: 0 },
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
    const conteo = {};
    let respondio = 0;
    encuestas.forEach(e => {
        const valor = campo(e, "provincia");
        if (!valor || !MAPA_PROVINCIA[valor]) return;
        respondio++;
        conteo[valor] = (conteo[valor] || 0) + 1;
    });

    mostrarN("nProvincia", respondio);

    const ordenados = Object.entries(conteo)
        .sort((a, b) => b[1] - a[1])
        .map(([codigo, count]) => ({
            label: MAPA_PROVINCIA[codigo],
            valor: respondio > 0 ? Number(((count / respondio) * 100).toFixed(1)) : 0,
            count
        }));

    const etiquetas = ordenados.map(d => d.label);
    const valores = ordenados.map(d => d.valor);

    const colorTexto = esModoOscuro() ? "#b3a695" : "#75695a";
    const colorGrid = esModoOscuro() ? "#3c3226" : "#e6ded2";

    if (chartProvincia) chartProvincia.destroy();

    chartProvincia = new Chart(document.getElementById("graficoProvincia"), {
        type: "bar",
        data: {
            labels: etiquetas,
            datasets: [{
                data: valores,
                backgroundColor: cssVar("--kimi-chart-1"),
                borderRadius: 4,
                barThickness: 18
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
                    ticks: { color: colorTexto, callback: v => v + "%" },
                    grid: { color: colorGrid }
                },
                y: {
                    ticks: { color: colorTexto, font: { size: 11 } },
                    grid: { display: false }
                }
            }
        }
    });
}

// ==========================================
// GRÁFICO: GÉNERO (dona)
// ==========================================

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

    const etiquetas = [];
    const valores = [];
    const colores = [];
    const colorMap = {
        "1": cssVar("--kimi-chart-1"),
        "2": cssVar("--kimi-chart-4"),
        "3": cssVar("--kimi-chart-2"),
        "0": cssVar("--kimi-chart-5")
    };

    Object.keys(MAPA_GENERO).forEach(codigo => {
        if (conteo[codigo]) {
            etiquetas.push(MAPA_GENERO[codigo]);
            valores.push(conteo[codigo]);
            colores.push(colorMap[codigo] || cssVar("--kimi-chart-5"));
        }
    });

    const colorTexto = esModoOscuro() ? "#b3a695" : "#75695a";
    const colorTextoPrincipal = esModoOscuro() ? "#f3ede2" : "#2b241c";

    if (chartGenero) chartGenero.destroy();
    if (etiquetas.length === 0) return;

    const totalGeneral = valores.reduce((a, b) => a + b, 0);

    chartGenero = new Chart(document.getElementById("graficoGenero"), {
        type: "doughnut",
        data: {
            labels: etiquetas,
            datasets: [{
                data: valores,
                backgroundColor: colores,
                borderColor: esModoOscuro() ? "#28211a" : "#ffffff",
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600, easing: "easeOutQuart" },
            plugins: {
                legend: {
                    position: window.innerWidth < QUIEBRE_MOVIL ? "bottom" : "right",
                    align: "center",
                    labels: {
                        color: colorTextoPrincipal,
                        font: { size: 12, weight: "600" },
                        boxWidth: 12,
                        padding: 10,
                        generateLabels(chart) {
                            const data = chart.data;
                            const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                            return data.labels.map((label, i) => {
                                const valor = data.datasets[0].data[i];
                                const pct = ((valor / total) * 100).toFixed(0);
                                return {
                                    text: `${label} · ${valor} (${pct}%)`,
                                    fillStyle: data.datasets[0].backgroundColor[i],
                                    strokeStyle: data.datasets[0].backgroundColor[i],
                                    color: colorTextoPrincipal,
                                    index: i
                                };
                            });
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = ((ctx.parsed / total) * 100).toFixed(1);
                            return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

// ==========================================
// GRÁFICO: PRINCIPAL ACTIVIDAD (dona)
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

    const etiquetas = ORDEN_ACTIVIDAD.filter(cat => conteo[cat]);
    const valores = etiquetas.map(cat => conteo[cat]);
    const colores = etiquetas.map(cat => {
        const varName = COLORES_ACTIVIDAD[cat];
        return varName.startsWith("var(") ? cssVar(varName.slice(4, -1)) : varName;
    });

    const colorTexto = esModoOscuro() ? "#b3a695" : "#75695a";
    const colorTextoPrincipal = esModoOscuro() ? "#f3ede2" : "#2b241c";

    if (chartActividad) chartActividad.destroy();
    if (etiquetas.length === 0) return;

    const totalGeneral = valores.reduce((a, b) => a + b, 0);
    mostrarN("nActividad", totalGeneral);
    document.getElementById("donaTotalActividad").innerHTML =
        `<strong>${totalGeneral}</strong> respuestas registradas`;

    const textoCentralDona = {
        id: "textoCentralDona",
        beforeDraw(chart) {
            const { ctx, chartArea: { width, height, left, top } } = chart;
            const centroX = left + width / 2;
            const centroY = top + height / 2;
            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "600 24px " + getComputedStyle(document.body).fontFamily;
            ctx.fillStyle = colorTextoPrincipal;
            ctx.fillText(totalGeneral, centroX, centroY - 6);
            ctx.font = "500 11px " + getComputedStyle(document.body).fontFamily;
            ctx.fillStyle = colorTexto;
            ctx.fillText("respuestas", centroX, centroY + 10);
            ctx.restore();
        }
    };

    chartActividad = new Chart(document.getElementById("graficoActividad"), {
        type: "doughnut",
        plugins: [textoCentralDona],
        data: {
            labels: etiquetas,
            datasets: [{
                data: valores,
                backgroundColor: colores,
                borderColor: esModoOscuro() ? "#28211a" : "#ffffff",
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600, easing: "easeOutQuart" },
            plugins: {
                legend: {
                    position: window.innerWidth < QUIEBRE_MOVIL ? "bottom" : "right",
                    align: "center",
                    labels: {
                        color: colorTextoPrincipal,
                        font: { size: 12, weight: "600" },
                        boxWidth: 12,
                        padding: 10,
                        generateLabels(chart) {
                            const data = chart.data;
                            const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                            return data.labels.map((label, i) => {
                                const valor = data.datasets[0].data[i];
                                const pct = ((valor / total) * 100).toFixed(0);
                                return {
                                    text: `${label} · ${valor} (${pct}%)`,
                                    fillStyle: data.datasets[0].backgroundColor[i],
                                    strokeStyle: data.datasets[0].backgroundColor[i],
                                    color: colorTextoPrincipal,
                                    index: i
                                };
                            });
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = ((ctx.parsed / total) * 100).toFixed(1);
                            return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
                        }
                    }
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

    const colorTexto = esModoOscuro() ? "#b3a695" : "#75695a";
    const colorGrid = esModoOscuro() ? "#3c3226" : "#e6ded2";

    if (chartAnioGraduacion) chartAnioGraduacion.destroy();
    if (anos.length === 0) return;

    chartAnioGraduacion = new Chart(document.getElementById("graficoAnioGraduacion"), {
        type: "bar",
        data: {
            labels: anos,
            datasets: [{
                data: valores,
                backgroundColor: cssVar("--kimi-chart-3"),
                borderRadius: 4,
                barThickness: 28
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600, easing: "easeOutQuart" },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.parsed.y} graduados`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: colorTexto },
                    grid: { color: colorGrid }
                },
                x: {
                    ticks: { color: colorTexto },
                    grid: { display: false }
                }
            }
        }
    });
}

// ==========================================
// GRÁFICO: TÍTULO OBTENIDO (barras horizontales, select_multiple)
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

    const etiquetas = ordenados.map(d => d.label);
    const valores = ordenados.map(d => d.valor);

    const colorTexto = esModoOscuro() ? "#b3a695" : "#75695a";
    const colorGrid = esModoOscuro() ? "#3c3226" : "#e6ded2";

    if (chartTitulo) chartTitulo.destroy();

    chartTitulo = new Chart(document.getElementById("graficoTitulo"), {
        type: "bar",
        data: {
            labels: etiquetas,
            datasets: [{
                data: valores,
                backgroundColor: cssVar("--kimi-chart-3"),
                borderRadius: 4,
                barThickness: 20
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
                    ticks: { color: colorTexto, callback: v => v + "%" },
                    grid: { color: colorGrid }
                },
                y: {
                    ticks: { color: colorTexto, font: { size: 11 } },
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

    const etiquetas = Object.keys(MAPA_MEDIO).map(c => MAPA_MEDIO[c]);
    const valores = Object.keys(MAPA_MEDIO).map(c =>
        respondio > 0 ? Number((((conteo[c] || 0) / respondio) * 100).toFixed(1)) : 0
    );

    const colorTexto = esModoOscuro() ? "#b3a695" : "#75695a";
    const colorGrid = esModoOscuro() ? "#3c3226" : "#e6ded2";

    if (chartMedio) chartMedio.destroy();

    chartMedio = new Chart(document.getElementById("graficoMedio"), {
        type: "bar",
        data: {
            labels: etiquetas,
            datasets: [{
                data: valores,
                backgroundColor: cssVar("--kimi-chart-4"),
                borderRadius: 4,
                barThickness: 22
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
                        label: ctx => `${ctx.parsed.x}%`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true, max: 100,
                    ticks: { color: colorTexto, callback: v => v + "%" },
                    grid: { color: colorGrid }
                },
                y: {
                    ticks: { color: colorTexto, font: { size: 12 } },
                    grid: { display: false }
                }
            }
        }
    });
}

// ==========================================
// MODO OSCURO
// ==========================================

const botonModoOscuro = document.getElementById("botonModoOscuro");
if (botonModoOscuro) {
    botonModoOscuro.addEventListener("click", () => {
        document.body.classList.toggle("modo-oscuro");
        const activo = document.body.classList.contains("modo-oscuro");
        botonModoOscuro.textContent = activo ? "☀️" : "🌙";
        botonModoOscuro.title = activo ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
        if (ultimosDatosCargados) renderizarTodo();
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