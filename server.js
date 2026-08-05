require("dotenv").config();

const path = require("path");
const express = require("express");
const axios = require("axios");

const app = express();

// =======================================
// CONFIGURACIÓN
// =======================================

const PORT = Number(process.env.PORT) || 3000;
const ASSET_ID = process.env.ASSET_ID || "";
const API_TOKEN = process.env.API_TOKEN || "";
const LIMITE_POR_PAGINA = 500;
const CACHE_TTL_MS = (Number(process.env.CACHE_TTL_SEGUNDOS) || 90) * 1000;
const TIMEOUT_MS = 30000;

if (!ASSET_ID || !API_TOKEN) {
    console.error("[CLIMA-SOCIAL] ⚠  Faltan variables de entorno: ASSET_ID y/o API_TOKEN.");
    console.error("[CLIMA-SOCIAL]    Copia .env.example a .env y completa los valores.");
}

// =======================================
// MIDDLEWARE DE SEGURIDAD
// =======================================

app.use((req, res, next) => {
    res.set({
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Referrer-Policy": "no-referrer",
        "X-XSS-Protection": "0"
    });
    next();
});

// Sirve únicamente la carpeta pública (frontend), nunca archivos del servidor.
app.use(express.static(path.join(__dirname, "public"), {
    dotfiles: "deny",
    maxAge: "1h",
    etag: true
}));

// =======================================
// CACHÉ EN MEMORIA PARA KOBO
// =======================================

let cache = {
    datos: null,
    timestamp: 0,
    enProceso: null
};

async function obtenerDatosKobo() {
    const ahora = Date.now();

    // Cache válida: devolver los datos en memoria
    if (cache.datos && ahora - cache.timestamp < CACHE_TTL_MS) {
        return cache.datos;
    }

    // Evitar peticiones duplicadas en paralelo
    if (cache.enProceso) {
        return cache.enProceso;
    }

    cache.enProceso = (async () => {
        let url = `https://kf.kobotoolbox.org/api/v2/assets/${encodeURIComponent(ASSET_ID)}/data/?limit=${LIMITE_POR_PAGINA}`;
        const resultados = [];
        let total = 0;

        while (url) {
            const respuesta = await axios.get(url, {
                headers: { Authorization: `Token ${API_TOKEN}` },
                timeout: TIMEOUT_MS,
                maxRedirects: 5
            });

            total = respuesta.data.count;
            resultados.push(...respuesta.data.results);
            url = respuesta.data.next;
        }

        cache.datos = { total, resultados, obtenidoEn: Date.now() };
        cache.timestamp = Date.now();
        return cache.datos;
    })();

    try {
        const datos = await cache.enProceso;
        return datos;
    } finally {
        cache.enProceso = null;
    }
}

// =======================================
// RUTAS DE API
// =======================================

app.get("/api/health", (req, res) => {
    res.json({
        estado: "ok",
        cacheActiva: Boolean(cache.datos),
        cacheEdadSegundos: cache.datos
            ? Math.round((Date.now() - cache.timestamp) / 1000)
            : null
    });
});

app.get("/api/config", (req, res) => {
    res.json({
        nombreProyecto: process.env.NOMBRE_PROYECTO || "Encuesta Artes y Cultura",
        metaTrabajadores: Number(process.env.META_TRABAJADORES) || 2100,
        metaGraduados: Number(process.env.META_GRADUADOS) || 400,
        valorConsentimientoSi: process.env.VALOR_CONSENTIMIENTO_SI || "1"
    });
});

app.get("/api/encuestas", async (req, res) => {
    try {
        if (!ASSET_ID || !API_TOKEN) {
            return res.status(503).json({
                error: "El servidor no tiene configuradas las credenciales de Kobo."
            });
        }
        const datos = await obtenerDatosKobo();
        res.set("Cache-Control", "no-store");
        res.json(datos);
    } catch (error) {
        const mensaje = error.response
            ? `Kobo respondió ${error.response.status}`
            : error.code === "ECONNABORTED"
                ? "Kobo tardó demasiado en responder"
                : error.message;
        console.error(`[${new Date().toLocaleTimeString("es-EC")}] Error al consultar Kobo: ${mensaje}`);
        res.status(502).json({ error: "No fue posible acceder a Kobo." });
    }
});

// API no encontrada
app.use("/api", (req, res) => {
    res.status(404).json({ error: "Ruta de API no encontrada." });
});

// Cualquier otra ruta → index (SPA simple)
app.use((req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =======================================
// ARRANQUE
// =======================================

app.listen(PORT, () => {
    console.log(`[CLIMA-SOCIAL] Servidor iniciado en http://localhost:${PORT}`);
    console.log(`[CLIMA-SOCIAL] Kobo ${ASSET_ID ? "configurado" : "NO configurado (faltan ASSET_ID/API_TOKEN)"}`);
});
