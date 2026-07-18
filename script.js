// ==========================================
// DASHBOARD CLIMA SOCIAL
// ==========================================

// La meta ahora es configurable — se carga desde /api/config
let META_ENCUESTAS = 1600;

// Coordenadas iniciales (Quito)
const centroMapa = [-0.1807, -78.4678];

// ==========================================
// CREAR MAPA
// ==========================================

const mapa = L.map("map").setView(centroMapa, 11);

// Mapa base
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
    maxZoom: 19
}).addTo(mapa);

// ==========================================
// LÍMITES PARROQUIALES
// ==========================================

fetch("assets/limites_parroquias.geojson")

    .then(respuesta => respuesta.json())

    .then(datosGeojson => {

        const capaLimites = L.geoJSON(datosGeojson, {

            style: {

                color: "#1e2882",
                weight: 2,
                fillColor: "#1e2882",
                fillOpacity: 0.04

            }

        });

        capaLimites.eachLayer(capa => {

            const nombre = capa.feature.properties.name;

            capa.bindTooltip(nombre, {

                sticky: true,
                className: "etiqueta-parroquia"

            });

        });

        capaLimites.addTo(mapa);

        // Encuadramos el mapa a los límites mientras llegan los datos reales
        mapa.fitBounds(capaLimites.getBounds(), { padding: [20, 20] });

    })

    .catch(error => {

        // Si no encuentra el archivo (ej. otro proyecto sin límites
        // configurados), no rompe el mapa, solo lo omite.
        console.log("No se cargaron límites parroquiales:", error.message);

    });

// ==========================================
// ACTUALIZAR HORA
// ==========================================

function actualizarHora() {

    const ahora = new Date();

    document.getElementById("hora").textContent =
        ahora.toLocaleTimeString("es-EC", {
            hour: "2-digit",
            minute: "2-digit"
        });

}

actualizarHora();

setInterval(actualizarHora, 60000);

// ==========================================
// PARSEAR MAPA DE ETIQUETAS
// Convierte "1:Hombre,2:Mujer" en { "1": "Hombre", "2": "Mujer" }
// ==========================================

function parsearMapa(texto) {

    const mapa = {};

    if (!texto) return mapa;

    texto.split(",").forEach(par => {

        const [codigo, etiqueta] = par.split(":");

        if (codigo && etiqueta) {

            mapa[codigo.trim()] = etiqueta.trim();

        }

    });

    return mapa;

}

// ==========================================
// LEER DATOS DEL SERVIDOR
// ==========================================

// Guardamos aquí los nombres de campo configurados en el .env
let campoEncuestador = "C_digo_encuestador";
let campoSupervisor = "C_digo_Supervisor";
let campoGenero = "";
let mapaGenero = {};
let campoParroquia = "";
let mapaParroquia = {};
let campoConsentimiento = "";
let valorConsentimientoSi = "1";

async function obtenerConfig() {

    try {

        const respuesta = await fetch("/api/config");

        const config = await respuesta.json();

        campoEncuestador = config.campoEncuestador;
        campoSupervisor = config.campoSupervisor;
        campoGenero = config.campoGenero;
        mapaGenero = parsearMapa(config.mapaGenero);

        campoParroquia = config.campoParroquia;
        mapaParroquia = parsearMapa(config.mapaParroquia);

        campoConsentimiento = config.campoConsentimiento;
        valorConsentimientoSi = config.valorConsentimientoSi;
        META_ENCUESTAS = Number(config.metaEncuestas);

        // Aplicar el nombre del proyecto al título y a la pestaña del navegador
        document.getElementById("tituloProyecto").textContent = config.nombreProyecto;
        document.title = config.nombreProyecto;

    } catch (error) {

        console.error("No se pudo cargar la configuración, usando valores por defecto.", error);

    }

}

async function obtenerDatos() {

    try {

        // Primero traemos la configuración (nombres de campo),
        // y luego los datos de las encuestas.
        await obtenerConfig();

        // Ruta relativa: funciona igual en localhost y una vez publicado
        const respuesta = await fetch("/api/encuestas");

        if (!respuesta.ok) {
            throw new Error("No fue posible obtener los datos.");
        }

        const datos = await respuesta.json();

        console.log(datos);

        dibujarPuntos(datos);

        // Todo salió bien: ocultamos overlay de carga y banner de error
        ocultarCarga();
        ocultarError();

    } catch (error) {

        console.error(error);

        // Ocultamos el overlay (para no dejar al usuario viendo
        // el spinner para siempre) y mostramos el aviso de error.
        ocultarCarga();
        mostrarError();

    }

}

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
// DIBUJAR PUNTOS
// ==========================================

function dibujarPuntos(datos) {

    // Actualizar tarjetas
    animarNumero("encuestas", datos.total);

    document.getElementById("meta").textContent = META_ENCUESTAS;

    const duracionProm = calcularDuracionPromedio(datos);

    document.getElementById("duracion").textContent =
        duracionProm !== null ? formatearDuracion(duracionProm) : "--";

    // Porcentaje de aceptación (solo si hay campo de consentimiento configurado)
    const cardAceptacion = document.getElementById("cardAceptacion");

    if (campoConsentimiento) {

        const porcentajeAceptacion = calcularPorcentajeAceptacion(datos);

        if (porcentajeAceptacion !== null) {

            cardAceptacion.style.display = "block";
            animarNumero("aceptacion", porcentajeAceptacion, "%");

        } else {

            cardAceptacion.style.display = "none";

        }

    } else {

        cardAceptacion.style.display = "none";

    }

    const avance = ((datos.total / META_ENCUESTAS) * 100).toFixed(1);

    animarNumero("avance", Number(avance), "%");

    actualizarAnilloProgreso(avance);

    const limites = [];

    datos.resultados.forEach(encuesta => {

        if (!encuesta._geolocation) return;

        const lat = encuesta._geolocation[0];
        const lon = encuesta._geolocation[1];

        // Algunas encuestas traen el campo _geolocation pero con
        // coordenadas vacías (null) — las ignoramos para no romper el mapa.
        if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) return;

        limites.push([lat, lon]);

        const codigoEnc = encuesta[campoEncuestador];

        const punto = L.circleMarker([lat, lon], {

            radius: 4,
            color: "#ffffff",
            weight: 0.6,
            fillColor: obtenerColorEncuestador(codigoEnc),
            fillOpacity: 0.85

        }).addTo(mapa);

        punto.bindPopup(`
            <b>Encuesta:</b> ${encuesta._id}<br>
            <b>Barrio:</b> ${encuesta["Localizacion/NOMBRE_DEL_BARRIO_O_SECTOR_Abierta"] || "Sin dato"}<br>
            <b>Encuestador:</b> ${codigoEnc || "Sin dato"}<br>
            <b>Supervisor:</b> ${encuesta[campoSupervisor] || "Sin dato"}<br>
            <b>Fecha:</b> ${encuesta["_submission_time"] || ""}
        `);

    });

    generarLeyendaEncuestadores(datos);

    if (limites.length > 0) {

        mapa.fitBounds(limites, {
            padding: [30, 30]
        });

    }

    // ===========================
    // GENERAR RANKINGS
    // ===========================

    generarRanking(datos);

    // ===========================
    // GENERAR GRÁFICO DE AVANCE DIARIO
    // ===========================

    generarGraficoDiario(datos);

    // ===========================
    // GENERAR GRÁFICO DE DISTRIBUCIÓN (ej. género)
    // ===========================

    generarGraficoDistribucion(datos, campoGenero, "seccionGenero", "tituloGenero", "graficoGenero", "Distribución por género");

    // ===========================
    // TABLA DE AVANCE POR PARROQUIA
    // ===========================

    generarTablaConteo(datos, campoParroquia, mapaParroquia, "seccionParroquia", "tablaParroquia");

}

//=====================================
// PROCESAR FECHAS -> CONTEO POR DÍA
//=====================================

function contarPorDia(datos) {

    // Objeto tipo { "2026-07-01": 12, "2026-07-02": 8, ... }
    const conteoPorDia = {};

    datos.resultados.forEach(encuesta => {

        const fechaCompleta = encuesta["_submission_time"];

        if (!fechaCompleta) return;

        // "2026-07-09T14:32:10" -> "2026-07-09"
        const dia = fechaCompleta.split("T")[0];

        conteoPorDia[dia] = (conteoPorDia[dia] || 0) + 1;

    });

    return conteoPorDia;

}

//=====================================
// GRÁFICO DE AVANCE DIARIO
//=====================================

let graficoAvance = null;

function generarGraficoDiario(datos) {

    const conteoPorDia = contarPorDia(datos);

    // Ordenar los días cronológicamente
    const dias = Object.keys(conteoPorDia).sort();

    const cantidades = dias.map(dia => conteoPorDia[dia]);

    // Actualizar tarjeta "Hoy"
    const hoyTexto = new Date().toISOString().split("T")[0];

    animarNumero("hoy", conteoPorDia[hoyTexto] || 0);

    // Formatear fechas para que se vean como "09 jul" en vez de "2026-07-09"
    const diasFormateados = dias.map(dia => {

        const fecha = new Date(dia + "T00:00:00");

        return fecha.toLocaleDateString("es-EC", {
            day: "2-digit",
            month: "short"
        });

    });

    const ctx = document.getElementById("grafico");

    // Paleta oficial de Clima Social, extraída del logo.
    // Se repite en ciclo si hay más días que colores.
    const paletaMarca = [
        "#1e2882", // azul marino
        "#bc3246", // rojo
        "#4f7a8c", // azul acero
        "#efa000", // dorado
        "#4f8232", // verde
        "#3c0050"  // morado
    ];

    const coloresBarras = dias.map((_, i) => paletaMarca[i % paletaMarca.length]);

    // Si el gráfico ya existe (por una actualización), lo destruimos
    // antes de crear uno nuevo para que no se dupliquen ni se peguen encima.
    if (graficoAvance) {
        graficoAvance.destroy();
    }

    graficoAvance = new Chart(ctx, {

        type: "bar",

        data: {

            labels: diasFormateados,

            datasets: [{

                label: "Encuestas por día",

                data: cantidades,

                backgroundColor: coloresBarras,

                borderRadius: 6

            }]

        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            plugins: {

                legend: {

                    display: false

                }

            },

            scales: {

                y: {

                    beginAtZero: true,

                    ticks: {

                        precision: 0

                    }

                }

            }

        }

    });

}
//=====================================
// RANKING ENCUESTADORES
//=====================================

function generarRanking(datos){

    const encuestadores={};

    const supervisores={};

    // Para calcular la duración promedio, máxima y mínima por encuestador
    const duracionSuma={};
    const duracionConteo={};
    const duracionMax={};
    const duracionMin={};

    datos.resultados.forEach(encuesta=>{

        const enc=encuesta[campoEncuestador];

        const sup=encuesta[campoSupervisor];

        if(enc){

            encuestadores[enc]=(encuestadores[enc]||0)+1;

            const inicio = encuesta["start"];
            const fin = encuesta["end"];

            const consintio = !campoConsentimiento ||
                encuesta[campoConsentimiento] === valorConsentimientoSi;

            if (inicio && fin && consintio) {

                const t1 = new Date(inicio).getTime();
                const t2 = new Date(fin).getTime();

                if (!isNaN(t1) && !isNaN(t2) && t2 > t1) {

                    const minutos = (t2 - t1) / 60000;

                    // Ignoramos valores absurdos (encuestas dejadas abiertas)
                    if (minutos <= 180) {

                        duracionSuma[enc] = (duracionSuma[enc] || 0) + minutos;
                        duracionConteo[enc] = (duracionConteo[enc] || 0) + 1;

                        if (duracionMax[enc] === undefined || minutos > duracionMax[enc]) {
                            duracionMax[enc] = minutos;
                        }

                        if (duracionMin[enc] === undefined || minutos < duracionMin[enc]) {
                            duracionMin[enc] = minutos;
                        }

                    }

                }

            }

        }

        if(sup){

            supervisores[sup]=(supervisores[sup]||0)+1;

        }

    });

    // Armar el objeto de duración promedio por encuestador
    const duracionPorEncuestador = {};

    Object.keys(encuestadores).forEach(enc => {

        if (duracionConteo[enc]) {
            duracionPorEncuestador[enc] = duracionSuma[enc] / duracionConteo[enc];
        }

    });

   mostrarRanking(
    encuestadores,
    "rankingEncuestadores",
    "Encuestador",
    duracionPorEncuestador,
    duracionMax,
    duracionMin
);

mostrarRanking(
    supervisores,
    "rankingSupervisores",
    "Supervisor"
);

}

//=====================================
// MOSTRAR RANKING
//=====================================

function mostrarRanking(objeto,id,tipo,duraciones,duracionesMax,duracionesMin){

    const contenedor=document.getElementById(id);

    contenedor.innerHTML="";

    const ranking=Object.entries(objeto)
        .sort((a,b)=>b[1]-a[1]);

    // Si no se encontró ningún dato con ese nombre de campo,
    // mostramos un aviso en vez de romper el resto del dashboard.
    if (ranking.length === 0) {

        contenedor.innerHTML = `<p style="color:#888;font-size:14px;">
            No se encontraron datos de "${tipo}" en esta encuesta.
        </p>`;

        return;

    }

    const maximo=ranking[0][1];

    ranking.forEach((item,index)=>{

        const porcentaje=(item[1]/maximo)*100;

        // Si nos pasaron duraciones (solo aplica a encuestadores),
        // armamos el texto de duración promedio de esa persona.
        let textoDuracion = "";

        if (duraciones && duraciones[item[0]] !== undefined) {

            textoDuracion = `<span class="duracion-item">⏱ ${formatearDuracion(duraciones[item[0]])} promedio`;

            if (duracionesMax && duracionesMax[item[0]] !== undefined) {

                textoDuracion += ` &nbsp;·&nbsp; máx ${formatearDuracion(duracionesMax[item[0]])}`;

            }

            if (duracionesMin && duracionesMin[item[0]] !== undefined) {

                textoDuracion += ` &nbsp;·&nbsp; mín ${formatearDuracion(duracionesMin[item[0]])}`;

            }

            textoDuracion += `</span>`;

        }

        contenedor.innerHTML+=`

        <div class="ranking-item">

            <div class="ranking-top">

                <span>${tipo} ${item[0]}</span>

                <span>${item[1]}</span>

            </div>

            <div class="barra">

                <div class="progreso" style="width:${porcentaje}%"></div>

            </div>

            ${textoDuracion}

        </div>

        `;

    });

}
//=====================================
// GRÁFICO DE DISTRIBUCIÓN (genérico)
// Sirve para cualquier pregunta cerrada:
// género, rango de edad, sí/no, etc.
// Si "campo" viene vacío, la sección se oculta.
//=====================================

let graficosDistribucion = {};

function generarGraficoDistribucion(datos, campo, idSeccion, idTitulo, idCanvas, tituloDefault) {

    const seccion = document.getElementById(idSeccion);

    // Sin campo configurado -> ocultamos la sección y no hacemos nada más
    if (!campo) {
        seccion.style.display = "none";
        return;
    }

    const conteo = {};

    datos.resultados.forEach(encuesta => {

        const valor = encuesta[campo];

        if (!valor) return;

        conteo[valor] = (conteo[valor] || 0) + 1;

    });

    const categorias = Object.keys(conteo);

    // Si no hay ningún dato con ese campo, ocultamos también
    if (categorias.length === 0) {
        seccion.style.display = "none";
        return;
    }

    seccion.style.display = "block";

    document.getElementById(idTitulo).textContent = tituloDefault;

    const cantidades = categorias.map(cat => conteo[cat]);

    // Traducir códigos crudos (ej. "1", "2") a etiquetas legibles
    // (ej. "Hombre", "Mujer") si hay un mapa configurado.
    const etiquetas = categorias.map(cat => mapaGenero[cat] || cat);

    const paletaMarca = [
        "#1e2882", "#bc3246", "#4f7a8c",
        "#efa000", "#4f8232", "#3c0050"
    ];

    const colores = categorias.map((_, i) => paletaMarca[i % paletaMarca.length]);

    const ctx = document.getElementById(idCanvas);

    if (graficosDistribucion[idCanvas]) {
        graficosDistribucion[idCanvas].destroy();
    }

    const totalGeneral = cantidades.reduce((a, b) => a + b, 0);

    // Plugin que dibuja el total en el centro de la dona
    const textoCentral = {

        id: "textoCentral",

        beforeDraw(chart) {

            const { ctx, chartArea: { width, height, left, top } } = chart;

            const centroX = left + width / 2;
            const centroY = top + height / 2;

            ctx.save();

            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            ctx.font = "700 26px 'Plus Jakarta Sans', sans-serif";
            ctx.fillStyle = "#3c3c3c";
            ctx.fillText(totalGeneral, centroX, centroY - 8);

            ctx.font = "500 11px 'Plus Jakarta Sans', sans-serif";
            ctx.fillStyle = "#6b6b6b";
            ctx.fillText("encuestas", centroX, centroY + 14);

            ctx.restore();

        }

    };

    graficosDistribucion[idCanvas] = new Chart(ctx, {

        type: "doughnut",

        plugins: [textoCentral],

        data: {

            labels: etiquetas,

            datasets: [{

                data: cantidades,

                backgroundColor: colores,

                borderColor: "#ffffff",

                borderWidth: 2

            }]

        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            plugins: {

                legend: {

                    position: "bottom",

                    labels: {

                        padding: 14,

                        font: {

                            family: "'Plus Jakarta Sans', sans-serif"

                        }

                    }

                },

                tooltip: {

                    callbacks: {

                        label: function(contexto) {

                            const total = cantidades.reduce((a, b) => a + b, 0);

                            const porcentaje = ((contexto.parsed / total) * 100).toFixed(1);

                            return `${contexto.label}: ${contexto.parsed} (${porcentaje}%)`;

                        }

                    }

                }

            }

        }

    });

}

//=====================================
// TABLA DE CONTEO (genérica)
// Sirve para cualquier pregunta cerrada con muchas
// categorías (parroquia, barrio, nivel educativo, etc.)
// Muestra una tabla ordenada de mayor a menor, que va
// "creciendo" a medida que aparecen categorías en los datos.
// Si "campo" viene vacío, la sección se oculta.
//=====================================

function generarTablaConteo(datos, campo, mapa, idSeccion, idContenedor) {

    const seccion = document.getElementById(idSeccion);

    if (!campo) {
        seccion.style.display = "none";
        return;
    }

    const conteo = {};

    datos.resultados.forEach(encuesta => {

        const valorCrudo = encuesta[campo];

        if (!valorCrudo) return;

        // Traduce el código (ej. "3") a su etiqueta legible
        // (ej. "EL PARAISO / LA 14") si hay un mapa configurado.
        const etiqueta = mapa[valorCrudo] || valorCrudo;

        conteo[etiqueta] = (conteo[etiqueta] || 0) + 1;

    });

    const filas = Object.entries(conteo).sort((a, b) => b[1] - a[1]);

    if (filas.length === 0) {
        seccion.style.display = "none";
        return;
    }

    seccion.style.display = "block";

    const total = filas.reduce((suma, fila) => suma + fila[1], 0);

    const contenedor = document.getElementById(idContenedor);

    let html = `
        <table class="tabla-datos">
            <thead>
                <tr>
                    <th>Parroquia</th>
                    <th>Encuestas</th>
                    <th>%</th>
                </tr>
            </thead>
            <tbody>
    `;

    filas.forEach(([nombre, cantidad]) => {

        const porcentaje = ((cantidad / total) * 100).toFixed(1);

        html += `
            <tr>
                <td>${nombre}</td>
                <td>${cantidad}</td>
                <td>
                    <div class="celda-porcentaje">
                        <div class="mini-barra">
                            <div class="mini-progreso" style="width:${porcentaje}%"></div>
                        </div>
                        <span>${porcentaje}%</span>
                    </div>
                </td>
            </tr>
        `;

    });

    html += `
            </tbody>
        </table>
    `;

    contenedor.innerHTML = html;

}

//=====================================
// DURACIÓN PROMEDIO POR ENCUESTA
// Usa los campos "start" y "end" que Kobo
// guarda automáticamente en cada envío.
//=====================================

function calcularDuracionPromedio(datos) {

    let sumaMinutos = 0;
    let contador = 0;

    datos.resultados.forEach(encuesta => {

        // Si hay un campo de consentimiento configurado, solo contamos
        // las encuestas donde la respuesta fue afirmativa.
        if (campoConsentimiento && encuesta[campoConsentimiento] !== valorConsentimientoSi) {
            return;
        }

        const inicio = encuesta["start"];
        const fin = encuesta["end"];

        if (!inicio || !fin) return;

        const t1 = new Date(inicio).getTime();
        const t2 = new Date(fin).getTime();

        if (isNaN(t1) || isNaN(t2) || t2 <= t1) return;

        const minutos = (t2 - t1) / 60000;

        // Ignoramos valores absurdos (ej. una encuesta dejada
        // abierta por horas sin cerrarla) para no distorsionar el promedio.
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

//=====================================
// ANILLO DE PROGRESO (tarjeta Avance)
//=====================================

function actualizarAnilloProgreso(porcentaje) {

    const circulo = document.getElementById("anilloProgreso");

    if (!circulo) return;

    const radio = 52;
    const circunferencia = 2 * Math.PI * radio;

    // Si se pasa de 100%, lo topamos visualmente en el anillo (pero
    // el texto sigue mostrando el número real, ej. "104%")
    const porcentajeVisual = Math.min(Number(porcentaje), 100);

    const offset = circunferencia - (porcentajeVisual / 100) * circunferencia;

    circulo.style.strokeDasharray = circunferencia;
    circulo.style.strokeDashoffset = offset;

}

//=====================================
// MODO OSCURO
//=====================================

const botonModoOscuro = document.getElementById("botonModoOscuro");

if (botonModoOscuro) {

    botonModoOscuro.addEventListener("click", () => {

        document.body.classList.toggle("modo-oscuro");

        const activo = document.body.classList.contains("modo-oscuro");

        botonModoOscuro.textContent = activo ? "☀️" : "🌙";
        botonModoOscuro.title = activo ? "Cambiar a modo claro" : "Cambiar a modo oscuro";

    });

}

//=====================================
// ANIMAR NÚMEROS
// Anima el conteo de un valor viejo a uno nuevo,
// en vez de que el número salte de golpe.
//=====================================

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

        elemento.textContent =
            (esEntero ? Math.round(valorActual) : valorActual.toFixed(1)) + sufijo;

        if (progreso < 1) {
            requestAnimationFrame(paso);
        }

    }

    requestAnimationFrame(paso);

}

//=====================================
// COLOR CONSISTENTE POR ENCUESTADOR
// Usa un "hash" del código para siempre asignarle
// el mismo color, sin importar el orden de los datos.
//=====================================

function obtenerColorEncuestador(codigo) {

    const paletaMarca = [
        "#1e2882", "#bc3246", "#4f7a8c",
        "#efa000", "#4f8232", "#3c0050"
    ];

    if (!codigo) return "#9aa0ab";

    const texto = String(codigo);

    let hash = 0;

    for (let i = 0; i < texto.length; i++) {
        hash = texto.charCodeAt(i) + ((hash << 5) - hash);
    }

    const indice = Math.abs(hash) % paletaMarca.length;

    return paletaMarca[indice];

}

//=====================================
// LEYENDA DE COLORES POR ENCUESTADOR
//=====================================

function generarLeyendaEncuestadores(datos) {

    const contenedor = document.getElementById("leyendaEncuestadores");

    if (!contenedor) return;

    const codigos = new Set();

    datos.resultados.forEach(encuesta => {

        const codigo = encuesta[campoEncuestador];

        if (codigo) codigos.add(codigo);

    });

    if (codigos.size === 0) {
        contenedor.innerHTML = "";
        return;
    }

    const codigosOrdenados = Array.from(codigos).sort();

    contenedor.innerHTML = codigosOrdenados.map(codigo => `
        <span class="leyenda-item">
            <span class="leyenda-punto" style="background:${obtenerColorEncuestador(codigo)}"></span>
            Encuestador ${codigo}
        </span>
    `).join("");

}

//=====================================
// PORCENTAJE DE ACEPTACIÓN
// % de personas que respondieron "Sí" a la pregunta
// de consentimiento, sobre el total que respondió esa pregunta.
//=====================================

function calcularPorcentajeAceptacion(datos) {

    let totalRespondio = 0;
    let totalAcepto = 0;

    datos.resultados.forEach(encuesta => {

        const valor = encuesta[campoConsentimiento];

        if (valor === undefined || valor === null || valor === "") return;

        totalRespondio++;

        if (valor === valorConsentimientoSi) totalAcepto++;

    });

    if (totalRespondio === 0) return null;

    return Number(((totalAcepto / totalRespondio) * 100).toFixed(1));

}
