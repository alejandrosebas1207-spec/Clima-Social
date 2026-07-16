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

    } catch (error) {

        console.error(error);

    }

}

obtenerDatos();

// ==========================================
// DIBUJAR PUNTOS
// ==========================================

function dibujarPuntos(datos) {

    // Actualizar tarjetas
    document.getElementById("encuestas").textContent = datos.total;

    document.getElementById("meta").textContent = META_ENCUESTAS;

    const avance = ((datos.total / META_ENCUESTAS) * 100).toFixed(1);

    document.getElementById("avance").textContent = avance + "%";

    const limites = [];

    datos.resultados.forEach(encuesta => {

        if (!encuesta._geolocation) return;

        const lat = encuesta._geolocation[0];
        const lon = encuesta._geolocation[1];

        // Algunas encuestas traen el campo _geolocation pero con
        // coordenadas vacías (null) — las ignoramos para no romper el mapa.
        if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) return;

        limites.push([lat, lon]);

        const punto = L.circleMarker([lat, lon], {

            radius: 3,
            color: "#ffffff",
            weight: 0.5,
            fillColor: "#1e2882",
            fillOpacity: 0.75

        }).addTo(mapa);

        punto.bindPopup(`
            <b>Encuesta:</b> ${encuesta._id}<br>
            <b>Barrio:</b> ${encuesta["Localizacion/NOMBRE_DEL_BARRIO_O_SECTOR_Abierta"] || "Sin dato"}<br>
            <b>Encuestador:</b> ${encuesta["C_digo_encuestador"] || "Sin dato"}<br>
            <b>Supervisor:</b> ${encuesta["C_digo_Supervisor"] || "Sin dato"}<br>
            <b>Fecha:</b> ${encuesta["_submission_time"] || ""}
        `);

    });

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

    document.getElementById("hoy").textContent = conteoPorDia[hoyTexto] || 0;

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

    datos.resultados.forEach(encuesta=>{

        const enc=encuesta[campoEncuestador];

        const sup=encuesta[campoSupervisor];

        if(enc){

            encuestadores[enc]=(encuestadores[enc]||0)+1;

        }

        if(sup){

            supervisores[sup]=(supervisores[sup]||0)+1;

        }

    });

   mostrarRanking(
    encuestadores,
    "rankingEncuestadores",
    "Encuestador"
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

function mostrarRanking(objeto,id,tipo){

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

        let puesto=index+1;

        let icono=puesto+"°";

        if(puesto===1) icono="🥇";
        if(puesto===2) icono="🥈";
        if(puesto===3) icono="🥉";

        const porcentaje=(item[1]/maximo)*100;

        contenedor.innerHTML+=`

        <div class="ranking-item">

            <div class="ranking-top">

                <span>${icono} ${tipo} ${item[0]}</span>

                <span>${item[1]}</span>

            </div>

            <div class="barra">

                <div class="progreso" style="width:${porcentaje}%"></div>

            </div>

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

    graficosDistribucion[idCanvas] = new Chart(ctx, {

        type: "doughnut",

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
