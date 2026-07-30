// ==========================================
// DASHBOARD — Encuesta Artes y Cultura (3ra edición)
// Tabs: Todos / Trabajadores / Graduados UArtes
// 3 KPIs + 6 gráficos (situación laboral, ingresos con
// promedio+mediana, actividad principal, gauges de inseguridad,
// satisfacción y recomendación — estas dos últimas solo graduados).
// ==========================================

let META_TRABAJADORES = 2100;
let META_GRADUADOS = 400;
let VALOR_SI = "1";

let filtroActual = "todos"; // 'todos' | 'trabajadores' | 'graduados'
let ultimosDatosCargados = null;

// Cada cuánto se refresca solo el tablero (milisegundos).
const INTERVALO_AUTOREFRESCO = 3 * 60 * 1000;

// Punto de quiebre usado para decidir la orientación de la leyenda
// de la dona (a la derecha en desktop, abajo en móvil).
const QUIEBRE_MOVIL = 700;

function esModoOscuro() {
    return document.body.classList.contains("modo-oscuro");
}

// ← HELPER NUEVO: resuelve variables CSS del :root
function cssVar(nombre) {
    return getComputedStyle(document.body).getPropertyValue(nombre).trim();
}

// ==========================================
// RESOLVER DE CAMPOS (Kobo anida en grupos: grupo/subgrupo/pregunta)
// ==========================================

function campo(encuesta, nombreCorto) {

    if (encuesta[nombreCorto] !== undefined) return encuesta[nombreCorto];

    const clave = Object.keys(encuesta).find(k => k.endsWith("/" + nombreCorto));

    return clave ? encuesta[clave] : undefined;

}

// ==========================================
// MAPAS DE ETIQUETAS
// ==========================================

// Orden solicitado: bajo remuneración, intermitente, sin remuneración, cesante/buscando
const ORDEN_SITUACION_LABORAL = ["1", "2", "4", "3"];
const MAPA_SITUACION_LABORAL = {
    "1": "Bajo remuneración",
    "2": "Intermitente",
    "3": "Cesante / buscando trabajo",
    "4": "Sin remuneración"
};

const MAPA_LIKERT = { "1": "Nada", "2": "Poco", "3": "Algo", "4": "Mucho" };
const ORDEN_LIKERT = ["4", "3", "2", "1"]; // Mucho, Algo, Poco, Nada (de mayor a menor)

const ORDEN_IMPACTO = ["1", "2", "3", "4"]; // Mucho, Algo, Poco, Nada
const MAPA_IMPACTO = { "1": "Mucho", "2": "Algo", "3": "Poco", "4": "Nada" };
const COLOR_IMPACTO = { "1": "var(--kimi-chart-2)", "2": "var(--kimi-chart-4)", "3": "var(--kimi-chart-1)", "4": "var(--kimi-chart-3)" };

// Actividad cultural principal (rc07a01, 12 categorías) consolidada en 7 buckets.
// Ver nota en el chat: la agrupación es una decisión editorial, ajustable.
const MAPA_ACTIVIDAD_BUCKET = {
    "1": "Artes musicales",
    "2": "Literatura",
    "3": "Audiovisual",
    "4": "Escénicas",
    "5": "Visuales",
    "6": "Visuales",       // Diseño e ilustración
    "7": "Otras",          // Patrimonio y memoria social
    "8": "Audiovisual",    // Artes digitales y nuevos medios
    "9": "Otras",          // Formación artística
    "10": "Gestión cultural",
    "11": "Otras",         // Estudios e investigación
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
        const config = await respuesta.json();

        META_TRABAJADORES = Number(config.metaTrabajadores);
        META_GRADUADOS = Number(config.metaGraduados);
        VALOR_SI = config.valorConsentimientoSi;

        document.getElementById("tituloProyecto").textContent = config.nombreProyecto;
        document.title = config.nombreProyecto;

    } catch (error) {

        console.error("No se pudo cargar la configuración, usando valores por defecto.", error);

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

        if (!silencioso) {
            ocultarCarga();
            mostrarError();
        }
        // En un refresco silencioso, si falla, se deja ver el último dato
        // bueno en pantalla en vez de tapar todo con el banner de error.

    }

}

function actualizarTimestamp() {
    const el = document.getElementById("ultimaActualizacion");
    if (!el) return;
    const hora = new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
    el.textContent = `Última actualización: ${hora}`;
}

// Auto-refresco: vuelve a pedir los datos cada cierto tiempo sin
// mostrar el overlay de carga, útil si esto queda proyectado en una
// pantalla durante la recolección.
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
// PROCESAMIENTO PRINCIPAL
// ==========================================

function procesarDatos(datos) {

    ultimosDatosCargados = datos;

    const trabajadores = datos.resultados.filter(e => campo(e, "consent") === VALOR_SI);
    const graduados = datos.resultados.filter(e => campo(e, "consentuartes") === VALOR_SI);

    ultimosDatosCargados.trabajadores = trabajadores;
    ultimosDatosCargados.graduados = graduados;

    renderizarTodo();

}

function renderizarTodo() {

    if (!ultimosDatosCargados) return;

    const { total, trabajadores, graduados } = ultimosDatosCargados;

    // Un registro es válido si aceptó consentimiento en cualquiera de las dos rutas.
    const idsTrabajadores = new Set(trabajadores.map(e => e._id));
    const idsGraduados = new Set(graduados.map(e => e._id));
    const idsValidos = new Set([...idsTrabajadores, ...idsGraduados]);

    let cohorteKPI;
    let metaKPI;

    if (filtroActual === "trabajadores") {
        cohorteKPI = trabajadores;
        metaKPI = META_TRABAJADORES;
    } else if (filtroActual === "graduados") {
        cohorteKPI = graduados;
        metaKPI = META_GRADUADOS;
    } else {
        cohorteKPI = null; // en "todos" se usa idsValidos.size (ver abajo), evita doble conteo
        metaKPI = META_TRABAJADORES + META_GRADUADOS;
    }

    // --- KPI 1: Encuestas válidas ---
    const totalValidasCohorte = filtroActual === "todos" ? idsValidos.size : cohorteKPI.length;

    animarNumero("kpiValidas", totalValidasCohorte);

    // --- KPI 2: Avance general ---
    const porcentajeAvance = metaKPI > 0 ? ((totalValidasCohorte / metaKPI) * 100).toFixed(1) : 0;
    animarNumero("kpiAvance", Number(porcentajeAvance), "%");
    document.getElementById("kpiMetaTexto").textContent = `${totalValidasCohorte} de ${metaKPI} encuestas`;

    // --- KPI 3: Duración promedio ---
    const registrosParaDuracion = filtroActual === "trabajadores" ? trabajadores
        : filtroActual === "graduados" ? graduados
        : datos_union(trabajadores, graduados);

    const duracionProm = calcularDuracionPromedio(registrosParaDuracion);
    document.getElementById("kpiDuracion").textContent =
        duracionProm !== null ? formatearDuracion(duracionProm) : "--";

    // --- Visibilidad de tarjetas por segmento ---
    document.querySelectorAll('[data-segmento="graduados"]').forEach(el => {
        el.classList.toggle("oculto", filtroActual === "trabajadores");
    });

    document.querySelectorAll('[data-segmento="trabajadores"]').forEach(el => {
        el.classList.toggle("oculto", filtroActual === "graduados");
    });

    // --- Gráficos: trabajadores siempre alimenta los 4 primeros ---
    if (filtroActual !== "graduados") {
        generarGraficoSituacion(trabajadores);
        generarGraficoIngresos(trabajadores);
        generarGraficoActividad(trabajadores);
        generarGaugesInseguridad(trabajadores);
    }

    // --- Gráficos exclusivos de graduados ---
    if (filtroActual !== "trabajadores") {
        generarGraficoSatisfaccion(graduados);
        generarGraficoRecomendaria(graduados);
    }

}

function datos_union(a, b) {
    const vistos = new Set();
    const resultado = [];
    [...a, ...b].forEach(e => {
        if (!vistos.has(e._id)) {
            vistos.add(e._id);
            resultado.push(e);
        }
    });
    return resultado;
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

    let sumaMinutos = 0;
    let contador = 0;

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

    if (contador === 0) return null;

    return sumaMinutos / contador;

}

function formatearDuracion(minutosDecimal) {
    const minutos = Math.floor(minutosDecimal);
    const segundos = Math.round((minutosDecimal - minutos) * 60);
    return `${minutos}m ${segundos}s`;
}

// ==========================================
// PLUGIN: etiqueta de % al final de barras horizontales
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

            // Si no hay espacio a la derecha (barra cerca del 100%), la
            // etiqueta se dibuja DENTRO de la barra en blanco para que no
            // se corte contra el borde del gráfico.
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
// GRÁFICO 1: SITUACIÓN LABORAL (barras horizontales)
// ← MEJORA B: colores categóricos por barra
// ==========================================

let chartSituacion = null;

// Muestra "n = X" junto al título de un gráfico, marcando en color
// de alerta cuando la muestra es tan baja que el % puede engañar.
function mostrarN(id, n) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = `n = ${n}`;
}

function generarGraficoSituacion(trabajadores) {

    const conteo = {};
    let respondio = 0;

    trabajadores.forEach(e => {
        const valor = campo(e, "p17");
        if (!valor) return;
        respondio++;
        conteo[valor] = (conteo[valor] || 0) + 1;
    });

    mostrarN("nSituacion", respondio);

    const etiquetas = ORDEN_SITUACION_LABORAL.map(c => MAPA_SITUACION_LABORAL[c]);
    const porcentajes = ORDEN_SITUACION_LABORAL.map(c =>
        respondio > 0 ? Number((((conteo[c] || 0) / respondio) * 100).toFixed(1)) : 0
    );

    // ← MEJORA B: un color distinto por categoría
    const coloresSituacion = [
        cssVar("--kimi-chart-1"),
        cssVar("--kimi-chart-2"),
        cssVar("--kimi-chart-3"),
        cssVar("--kimi-chart-5")
    ];

    const colorTexto = esModoOscuro() ? "#b3a695" : "#75695a";
    const colorGrid = esModoOscuro() ? "#3c3226" : "#e6ded2";

    if (chartSituacion) chartSituacion.destroy();

    chartSituacion = new Chart(document.getElementById("graficoSituacion"), {

        type: "bar",

        data: {
            labels: etiquetas,
            datasets: [{
                data: porcentajes,
                backgroundColor: coloresSituacion,
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
                    beginAtZero: true,
                    max: 100,
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
// GRÁFICO 2: INGRESO MENSUAL (promedio + mediana superpuesta)
// ← MEJORA A: línea de mediana negra/blanca según modo
// ==========================================

let chartIngresos = null;

function promedioYMediana(valores) {

    const limpios = valores.filter(v => !isNaN(v) && v > 0).sort((a, b) => a - b);

    if (limpios.length === 0) return { promedio: 0, mediana: 0 };

    const promedio = limpios.reduce((a, b) => a + b, 0) / limpios.length;

    const mitad = Math.floor(limpios.length / 2);
    const mediana = limpios.length % 2 !== 0
        ? limpios[mitad]
        : (limpios[mitad - 1] + limpios[mitad]) / 2;

    return { promedio, mediana };

}

// Muestra el $ de cada barra (promedio) directamente sobre el gráfico,
// sin necesitar pasar el cursor.
const pluginEtiquetaIngresos = {
    id: "etiquetaIngresos",
    afterDatasetsDraw(chart) {

        const { ctx } = chart;
        const metaBarra = chart.getDatasetMeta(0); // dataset 0 = barras

        ctx.save();
        ctx.textAlign = "center";
        ctx.font = "600 12px " + getComputedStyle(document.body).fontFamily;
        ctx.fillStyle = esModoOscuro() ? "#f3ede2" : "#2b241c";

        metaBarra.data.forEach((barra, i) => {
            const valor = chart.data.datasets[0].data[i];
            ctx.fillText("$" + Math.round(valor), barra.x, barra.y - 8);
        });

        ctx.restore();

    }
};

function generarGraficoIngresos(trabajadores) {

    const principal = promedioYMediana(trabajadores.map(e => Number(campo(e, "p20"))));
    const secundaria = promedioYMediana(trabajadores.map(e => Number(campo(e, "p29"))));
    const noCultural = promedioYMediana(trabajadores.map(e => Number(campo(e, "p32"))));

    const nPrincipal = trabajadores.filter(e => Number(campo(e, "p20")) > 0).length;
    mostrarN("nIngresos", nPrincipal);

    const colorTexto = esModoOscuro() ? "#b3a695" : "#75695a";
    const colorGrid = esModoOscuro() ? "#3c3226" : "#e6ded2";
    const colorMediana = esModoOscuro() ? "#f3ede2" : "#2b241c";

    if (chartIngresos) chartIngresos.destroy();

    chartIngresos = new Chart(document.getElementById("graficoIngresos"), {

        plugins: [pluginEtiquetaIngresos],

        data: {
            labels: ["Principal", "Secundaria", "No cultural"],
            datasets: [
                {
                    type: "bar",
                    label: "Promedio",
                    data: [principal.promedio, secundaria.promedio, noCultural.promedio],
                    backgroundColor: cssVar("--kimi-chart-1"),
                    borderRadius: 4,
                    barThickness: 46,
                    order: 2
                },
                // ← MEJORA A: línea de mediana superpuesta
                {
                    type: "line",
                    label: "Mediana",
                    data: [principal.mediana, secundaria.mediana, noCultural.mediana],
                    borderColor: colorMediana,
                    backgroundColor: colorMediana,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBackgroundColor: colorMediana,
                    borderWidth: 2,
                    tension: 0,
                    order: 1
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
                        label: ctx => `${ctx.dataset.label}: $${Math.round(ctx.parsed.y)}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: colorTexto, callback: v => "$" + v },
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
// GRÁFICO 3: ACTIVIDAD CULTURAL PRINCIPAL (dona, leyenda lateral)
// ← FIX: color de leyenda en modo oscuro
// ← MEJORA D: muestra n = X
// ==========================================

let chartActividad = null;

function generarGraficoActividad(trabajadores) {

    const conteo = {};

    trabajadores.forEach(e => {
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

    // ← MEJORA D: muestra el tamaño de muestra
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
            ctx.font = "600 26px " + getComputedStyle(document.body).fontFamily;
            ctx.fillStyle = colorTextoPrincipal;
            ctx.fillText(totalGeneral, centroX, centroY - 8);
            ctx.font = "500 12px " + getComputedStyle(document.body).fontFamily;
            ctx.fillStyle = colorTexto;
            ctx.fillText("respuestas", centroX, centroY + 12);
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
                        font: { size: 13, weight: "600" },
                        boxWidth: 14,
                        padding: 14,
                        // ← FIX: se agrega color explícito por etiqueta para modo oscuro
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
                                    color: colorTextoPrincipal,  // ← FIX
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
// GRÁFICO 4: GAUGES SEMICIRCULARES — IMPACTO DE LA INSEGURIDAD
// ==========================================

function generarGaugesInseguridad(trabajadores) {

    const conteo = {};
    let respondio = 0;

    trabajadores.forEach(e => {
        const valor = campo(e, "p50");
        if (!valor) return;
        respondio++;
        conteo[valor] = (conteo[valor] || 0) + 1;
    });

    mostrarN("nInseguridad", respondio);

    const contenedor = document.getElementById("gaugesInseguridad");
    contenedor.innerHTML = "";

    const radio = 50;
    const longitudArco = Math.PI * radio; // longitud de un semicírculo

    ORDEN_IMPACTO.forEach(codigo => {

        const porcentaje = respondio > 0 ? ((conteo[codigo] || 0) / respondio) * 100 : 0;
        const offset = longitudArco * (1 - porcentaje / 100);

        const colorVar = COLOR_IMPACTO[codigo];
        const colorResuelto = colorVar.startsWith("var(")
            ? cssVar(colorVar.slice(4, -1))
            : colorVar;

        const item = document.createElement("div");
        item.className = "gauge-item";

        item.innerHTML = `
            <svg class="gauge-svg" viewBox="0 0 120 70">
                <path class="gauge-arco-fondo" d="M 10 60 A 50 50 0 0 1 110 60"></path>
                <path class="gauge-arco-valor" d="M 10 60 A 50 50 0 0 1 110 60"
                      style="stroke:${colorResuelto}; stroke-dasharray:${longitudArco}; stroke-dashoffset:${longitudArco};"></path>
                <text class="gauge-porcentaje" x="60" y="58" text-anchor="middle">${porcentaje.toFixed(0)}%</text>
            </svg>
            <span class="gauge-etiqueta">${MAPA_IMPACTO[codigo]}</span>
        `;

        contenedor.appendChild(item);

        // Forzar reflow para que la transición CSS se dispare
        requestAnimationFrame(() => {
            const arco = item.querySelector(".gauge-arco-valor");
            if (arco) arco.style.strokeDashoffset = offset;
        });

    });

}

// ==========================================
// GRÁFICO 5: SATISFACCIÓN CON LA FORMACIÓN (Likert, solo graduados)
// ==========================================

let chartSatisfaccion = null;

function generarGraficoSatisfaccion(graduados) {

    const conteo = {};
    let respondio = 0;

    graduados.forEach(e => {
        const valor = campo(e, "p15u");
        if (!valor) return;
        respondio++;
        conteo[valor] = (conteo[valor] || 0) + 1;
    });

    mostrarN("nSatisfaccion", respondio);

    const etiquetas = ORDEN_LIKERT.map(c => MAPA_LIKERT[c]);
    const porcentajes = ORDEN_LIKERT.map(c =>
        respondio > 0 ? Number((((conteo[c] || 0) / respondio) * 100).toFixed(1)) : 0
    );

    const colorTexto = esModoOscuro() ? "#b3a695" : "#75695a";
    const colorGrid = esModoOscuro() ? "#3c3226" : "#e6ded2";

    if (chartSatisfaccion) chartSatisfaccion.destroy();

    chartSatisfaccion = new Chart(document.getElementById("graficoSatisfaccion"), {

        type: "bar",

        data: {
            labels: etiquetas,
            datasets: [{
                data: porcentajes,
                backgroundColor: cssVar("--kimi-chart-3"),
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
                tooltip: { callbacks: { label: ctx => `${ctx.parsed.x}%` } }
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
// GRÁFICO 6: ¿RECOMENDARÍA SU CARRERA? (binarizado Sí/No, solo graduados)
// Nota: el formulario mide esto en escala de 4 niveles (Nada/Poco/Algo/Mucho).
// Se agrupa Mucho+Algo = "Sí" y Poco+Nada = "No" para el comparativo pedido.
// ==========================================

let chartRecomendaria = null;

function generarGraficoRecomendaria(graduados) {

    let respondio = 0;
    let siCount = 0;

    graduados.forEach(e => {
        const valor = campo(e, "p18u");
        if (!valor) return;
        respondio++;
        if (valor === "3" || valor === "4") siCount++; // Algo o Mucho
    });

    const noCount = respondio - siCount;

    mostrarN("nRecomendaria", respondio);

    const porcentajeSi = respondio > 0 ? Number(((siCount / respondio) * 100).toFixed(1)) : 0;
    const porcentajeNo = respondio > 0 ? Number(((noCount / respondio) * 100).toFixed(1)) : 0;

    const colorTexto = esModoOscuro() ? "#b3a695" : "#75695a";
    const colorGrid = esModoOscuro() ? "#3c3226" : "#e6ded2";

    if (chartRecomendaria) chartRecomendaria.destroy();

    chartRecomendaria = new Chart(document.getElementById("graficoRecomendaria"), {

        type: "bar",

        data: {
            labels: ["Sí", "No"],
            datasets: [{
                data: [porcentajeSi, porcentajeNo],
                backgroundColor: [cssVar("--kimi-chart-3"), cssVar("--kimi-chart-2")],
                borderRadius: 4,
                barThickness: 26
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
                tooltip: { callbacks: { label: ctx => `${ctx.parsed.x}%` } }
            },
            scales: {
                x: {
                    beginAtZero: true, max: 100,
                    ticks: { color: colorTexto, callback: v => v + "%" },
                    grid: { color: colorGrid }
                },
                y: {
                    ticks: { color: colorTexto, font: { size: 13 } },
                    grid: { display: false }
                }
            }
        }

    });

}

// ==========================================
// ANIMAR NÚMEROS
// ==========================================

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
// RESPONSIVE: re-renderizar al cruzar el punto de quiebre móvil/desktop
// (ej. al rotar el teléfono), sin recalcular en cada pixel de resize.
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