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
// LEER DATOS DEL SERVIDOR
// ==========================================

// Guardamos aquí los nombres de campo configurados en el .env
let campoEncuestador = "C_digo_encuestador";
let campoSupervisor = "C_digo_Supervisor";

async function obtenerConfig() {

    try {

        const respuesta = await fetch("/api/config");

        const config = await respuesta.json();

        campoEncuestador = config.campoEncuestador;
        campoSupervisor = config.campoSupervisor;
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