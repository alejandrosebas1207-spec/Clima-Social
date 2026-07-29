require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());

// Sirve los archivos del frontend (index.html, script.js, style.css)
// desde la misma carpeta del proyecto.
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;

//=======================================
// Ruta de configuración
// Esta encuesta (Condiciones Laborales - Artes y Cultura) no tiene
// campos de encuestador/supervisor ni geolocalización: se aplica vía
// callcenter y de forma autoadministrada. Por eso la config se reduce
// a lo que sí varía entre despliegues: nombre del proyecto y metas.
//=======================================

app.get("/api/config", (req, res) => {

    res.json({

        nombreProyecto: process.env.NOMBRE_PROYECTO || "Encuesta Artes y Cultura",

        // Meta de gestores culturales / trabajadores del sector
        metaTrabajadores: process.env.META_TRABAJADORES || 2100,

        // Meta de graduados de la Universidad de las Artes
        metaGraduados: process.env.META_GRADUADOS || 400,

        // Valor que representa una respuesta afirmativa en las preguntas
        // de consentimiento (consent, consentuartes, grad).
        valorConsentimientoSi: process.env.VALOR_CONSENTIMIENTO_SI || "1"

    });

});

//=======================================
// Ruta para obtener datos de Kobo
//=======================================

app.get("/api/encuestas", async (req, res) => {

    try {

        let url = `https://kf.kobotoolbox.org/api/v2/assets/${process.env.ASSET_ID}/data/?limit=500`;

        let resultados = [];

        let total = 0;

        while (url) {

            const respuesta = await axios.get(url, {

                headers: {

                    Authorization: `Token ${process.env.API_TOKEN}`

                }

            });

            total = respuesta.data.count;

            resultados.push(...respuesta.data.results);

            url = respuesta.data.next;

        }

        res.json({

            total,

            resultados

        });

    }

    catch (error) {

        console.log(error.message);

        res.status(500).json({

            error: "No fue posible acceder a Kobo."

        });

    }

});

app.listen(PORT, () => {

    console.log(`Servidor iniciado en http://localhost:${PORT}`);

});
