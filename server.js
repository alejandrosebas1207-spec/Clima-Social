require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());

const PORT = process.env.PORT || 3000;

//=======================================
// Ruta de prueba
//=======================================

app.get("/", (req, res) => {

    res.send("Servidor funcionando correctamente.");

});

//=======================================
// Ruta para obtener datos de Kobo
//=======================================

app.get("/api/encuestas", async (req, res) => {

    try {

        let url = `https://kf.kobotoolbox.org/api/v2/assets/${process.env.ASSET_ID}/data/?limit=500`;

let resultados = [];

let total = 0;

while(url){

    const respuesta = await axios.get(url,{

        headers:{

            Authorization:`Token ${process.env.API_TOKEN}`

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