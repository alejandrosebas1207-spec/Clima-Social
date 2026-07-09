// ==========================================
// DASHBOARD CLIMA SOCIAL
// ==========================================

// Meta del proyecto
const META_ENCUESTAS = 1600;

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

async function obtenerDatos() {

    try {

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
            fillColor: "#1565C0",
            fillOpacity: 0.7

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

}
//=====================================
// RANKING ENCUESTADORES
//=====================================

function generarRanking(datos){

    const encuestadores={};

    const supervisores={};

    datos.resultados.forEach(encuesta=>{

        const enc=encuesta["C_digo_encuestador"];

        const sup=encuesta["C_digo_Supervisor"];

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