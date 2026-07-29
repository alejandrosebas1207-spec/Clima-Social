// ==========================================
// DASHBOARD CLIMA SOCIAL
// Encuesta: Condiciones Laborales - Trabajadores de las Artes y la Cultura
// (OEI / Universidad de las Artes)
//
// Esta encuesta se aplica vía callcenter y de forma autoadministrada, y no
// tiene campos de encuestador/supervisor ni geolocalización, así que este
// tablero no incluye mapa ni ranking de aplicadores — se enfoca en el
// avance de dos metas (Trabajadores del sector y Graduados UArtes) y en
// el perfil sociolaboral de quienes respondieron.
// ==========================================

// Meta general — se carga desde /api/config
let META_ENCUESTAS = 1100;
let VALOR_SI = "1";

// Guardamos los últimos datos para poder redibujar los gráficos
// (con los colores correctos) al cambiar de modo oscuro/claro.
let ultimosDatosCargados = null;

function esModoOscuro() {
    return document.body.classList.contains("modo-oscuro");
}

// ==========================================
// RESOLVER DE CAMPOS
// Kobo devuelve los campos anidados en grupos con el formato
// "grupo/subgrupo/pregunta". En vez de hardcodear la ruta completa
// de cada grupo (frágil si cambia el formulario), buscamos la clave
// que TERMINA en "/nombreCorto", o el nombre corto exacto si no
// está agrupado.
// ==========================================

function campo(encuesta, nombreCorto) {

    if (encuesta[nombreCorto] !== undefined) return encuesta[nombreCorto];

    const clave = Object.keys(encuesta).find(k => k.endsWith("/" + nombreCorto));

    return clave ? encuesta[clave] : undefined;

}

// ==========================================
// MAPAS DE ETIQUETAS (fijos para esta encuesta)
// ==========================================

const MAPA_GENERO = { "1": "Femenino", "2": "Masculino", "3": "No binario", "0": "Prefiere no responder" };

const MAPA_ETNIA = {
    "1": "Indígena", "2": "Afroecuatoriano/a", "3": "Montubio/a",
    "4": "Mestizo/a", "5": "Blanco/a", "6": "Otro/a"
};

const MAPA_NIVEL_ESTUDIOS = {
    "1": "Ninguno", "2": "Primaria incompleta", "3": "Primaria completa",
    "4": "Bachillerato incompleto", "5": "Bachillerato completo",
    "6": "Universitaria incompleta", "7": "Universitaria completa",
    "8_1": "Posgrado", "9": "Doctorado", "10": "Posdoctorado", "11": "Técnica, artesano"
};

const MAPA_ACTIVIDAD_PRINCIPAL = {
    "1": "Artes musicales y sonoridades", "2": "Artes literarias y editorial",
    "3": "Artes cinematográficas y audiovisuales", "4": "Artes vivas y escénicas",
    "5": "Artes plásticas y visuales", "6": "Diseño e ilustración",
    "7": "Patrimonio y memoria social", "8": "Artes digitales y nuevos medios",
    "9": "Formación artística", "10": "Producción y gestión cultural",
    "11": "Estudios e investigación en artes y cultura", "12": "Otra"
};

const MAPA_SITUACION_LABORAL = {
    "1": "Trabajando bajo remuneración", "2": "Trabajando de manera intermitente",
    "3": "Cesante / buscando trabajo", "4": "Trabajando sin remuneración"
};

const MAPA_SEGURO = {
    "1": "Seguro social (empleador)", "2": "Seguro social para artistas",
    "3": "Seguro social voluntario", "4": "Seguro privado", "5": "Ninguno"
};

const MAPA_SATISFACCION = { "1": "Nada", "2": "Poco", "3": "Algo", "4": "Mucho" };
const MAPA_RECOMENDARIA = { "1": "Nada", "2": "Poco", "3": "Algo", "4": "Mucho" };

const MAPA_INTERES_POSGRADO = {
    "1": "Sí, en la UArtes", "2": "Sí, en otra institución", "3": "No estoy interesado/a"
};

const PALETA_MARCA = ["#1e2882", "#bc3246", "#4f7a8c", "#efa000", "#4f8232", "#3c0050"];

// ==========================================
// ACTUALIZAR HORA
// ==========================================

function actualizarHora() {

    const ahora = new Date();

    const horaTexto = ahora.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });

    document.getElementById("hora").textContent = horaTexto.replace(/ /g, "\u00A0");

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

        META_ENCUESTAS = Number(config.metaEncuestas);
        VALOR_SI = config.valorConsentimientoSi;

        document.getElementById("tituloProyecto").textContent = config.nombreProyecto;
        document.title = config.nombreProyecto;

        document.getElementById("metaGeneralTexto").textContent = META_ENCUESTAS;

    } catch (error) {

        console.error("No se pudo cargar la configuración, usando valores por defecto.", error);

    }

}

async function obtenerDatos() {

    try {

        await obtenerConfig();

        const respuesta = await fetch("/api/encuestas");

        if (!respuesta.ok) throw new Error("No fue posible obtener los datos.");

        const datos = await respuesta.json();

        console.log(datos);

        procesarDatos(datos);

        ocultarCarga();
        ocultarError();

    } catch (error) {

        console.error(error);

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
// PROCESAMIENTO PRINCIPAL
// ==========================================

function procesarDatos(datos) {

    ultimosDatosCargados = datos;

    // Un registro se considera válido si aceptó el consentimiento en
    // cualquiera de las dos rutas (trabajador general y/o graduado UArtes).
    const registrosValidos = datos.resultados.filter(e =>
        campo(e, "consent") === VALOR_SI || campo(e, "consentuartes") === VALOR_SI
    );

    const totalValidas = registrosValidos.length;
    const totalNoValidas = datos.total - totalValidas;

    animarNumero("encuestas", totalValidas);

    const subtituloEncuestas = document.getElementById("subtituloEncuestas");

    if (totalNoValidas > 0) {
        subtituloEncuestas.textContent = `+${totalNoValidas} no aceptaron`;
        subtituloEncuestas.style.display = "inline-block";
    } else {
        subtituloEncuestas.style.display = "none";
    }

    // Duración promedio (sobre registros válidos)
    const duracionProm = calcularDuracionPromedio(registrosValidos);
    document.getElementById("duracion").textContent =
        duracionProm !== null ? formatearDuracion(duracionProm) : "--";

    // % de aceptación combinado (sobre quienes respondieron alguna
    // de las dos preguntas de consentimiento)
    const porcentajeAceptacion = calcularPorcentajeAceptacion(datos.resultados);
    const cardAceptacion = document.getElementById("cardAceptacion");

    if (porcentajeAceptacion !== null) {
        cardAceptacion.style.display = "block";
        animarNumero("aceptacion", porcentajeAceptacion, "%");
    } else {
        cardAceptacion.style.display = "none";
    }

    // Hoy
    const hoyTexto = new Date().toISOString().split("T")[0];
    const encuestasHoy = registrosValidos.filter(e =>
        (campo(e, "_submission_time") || "").split("T")[0] === hoyTexto
    ).length;
    animarNumero("hoy", encuestasHoy);

    // ===========================
    // AVANCE GENERAL (una sola meta) + desglose por segmento
    // ===========================

    const trabajadores = datos.resultados.filter(e => campo(e, "consent") === VALOR_SI);
    const graduados = datos.resultados.filter(e => campo(e, "consentuartes") === VALOR_SI);

    actualizarAvanceSegmento(totalValidas, META_ENCUESTAS, "anilloGeneral", "avanceGeneral", "totalGeneral");

    animarNumero("totalTrabajadores", trabajadores.length);
    animarNumero("totalGraduados", graduados.length);

    // ===========================
    // GRÁFICO DE AVANCE DIARIO (apilado)
    // ===========================

    generarGraficoDiario(trabajadores, graduados);

    // ===========================
    // PERFIL SOCIOLABORAL — TRABAJADORES
    // ===========================

    generarDona(trabajadores, "p5", MAPA_GENERO, "graficoGenero", "Distribución por género");
    generarDona(trabajadores, "p6", MAPA_ETNIA, "graficoEtnia", "Autoidentificación étnica");
    generarDona(trabajadores, "p17", MAPA_SITUACION_LABORAL, "graficoSituacionLaboral", "Situación laboral");
    generarDona(trabajadores, "p41", MAPA_SEGURO, "graficoSeguro", "Afiliación a seguro médico", { multiple: true });
    generarDona(trabajadores, "p50", { "1": "Mucho", "2": "Algo", "3": "Poco", "4": "Nada" }, "graficoImpactoInseguridad", "Impacto de la inseguridad");
    generarDona(trabajadores, "p9", MAPA_NIVEL_ESTUDIOS, "graficoNivelEstudios", "Nivel de estudios");

    generarTablaConteo(trabajadores, "p13", MAPA_ACTIVIDAD_PRINCIPAL, "tablaActividad", "Actividad");

    actualizarIngresos(trabajadores);
    actualizarPorcentajeInseguridad(trabajadores);
    actualizarPorcentajeSinSeguro(trabajadores);

    // ===========================
    // GRADUADOS UARTES
    // ===========================

    generarDona(graduados, "p15u", MAPA_SATISFACCION, "graficoSatisfaccion", "Satisfacción con la formación");
    generarDona(graduados, "p18u", MAPA_RECOMENDARIA, "graficoRecomendaria", "¿Recomendaría su carrera?");
    generarDona(graduados, "p11u", MAPA_INTERES_POSGRADO, "graficoInteresPosgrado", "Interés en posgrado");

}

// ==========================================
// AVANCE POR SEGMENTO (anillo + texto)
// ==========================================

function actualizarAvanceSegmento(total, meta, idAnillo, idTexto, idTotal) {

    const porcentaje = meta > 0 ? ((total / meta) * 100).toFixed(1) : 0;

    animarNumero(idTexto, Number(porcentaje), "%");
    animarNumero(idTotal, total);

    const circulo = document.getElementById(idAnillo);
    if (!circulo) return;

    const radio = 52;
    const circunferencia = 2 * Math.PI * radio;
    const porcentajeVisual = Math.min(Number(porcentaje), 100);
    const offset = circunferencia - (porcentajeVisual / 100) * circunferencia;

    circulo.style.strokeDasharray = circunferencia;
    circulo.style.strokeDashoffset = offset;

}

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

        // Ignoramos valores absurdos (encuestas dejadas abiertas por horas)
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
// % ACEPTACIÓN COMBINADO
// ==========================================

function calcularPorcentajeAceptacion(resultados) {

    let totalRespondio = 0;
    let totalAcepto = 0;

    resultados.forEach(encuesta => {

        const consent = campo(encuesta, "consent");
        const consentuartes = campo(encuesta, "consentuartes");

        // Usamos la primera pregunta de consentimiento que la persona
        // efectivamente respondió (consentuartes si es graduado, consent
        // en caso contrario).
        const valor = consentuartes !== undefined ? consentuartes : consent;

        if (valor === undefined || valor === null || valor === "") return;

        totalRespondio++;

        if (valor === VALOR_SI) totalAcepto++;

    });

    if (totalRespondio === 0) return null;

    return Number(((totalAcepto / totalRespondio) * 100).toFixed(1));

}

// ==========================================
// GRÁFICO DE AVANCE DIARIO (apilado por segmento)
// ==========================================

let graficoAvance = null;

function contarPorDia(registros) {

    const conteo = {};

    registros.forEach(encuesta => {

        const fechaCompleta = campo(encuesta, "_submission_time");
        if (!fechaCompleta) return;

        const dia = fechaCompleta.split("T")[0];
        conteo[dia] = (conteo[dia] || 0) + 1;

    });

    return conteo;

}

function generarGraficoDiario(trabajadores, graduados) {

    const conteoTrabajadores = contarPorDia(trabajadores);
    const conteoGraduados = contarPorDia(graduados);

    const diasSet = new Set([...Object.keys(conteoTrabajadores), ...Object.keys(conteoGraduados)]);
    const dias = Array.from(diasSet).sort();

    const diasFormateados = dias.map(dia => {
        const fecha = new Date(dia + "T00:00:00");
        return fecha.toLocaleDateString("es-EC", { day: "2-digit", month: "short" });
    });

    const datosTrabajadores = dias.map(d => conteoTrabajadores[d] || 0);
    const datosGraduados = dias.map(d => conteoGraduados[d] || 0);

    const colorTexto = esModoOscuro() ? "#c7cbd4" : "#6b6b6b";
    const colorGrid = esModoOscuro() ? "rgba(255,255,255,0.08)" : "#eceef1";

    const ctx = document.getElementById("grafico");

    if (graficoAvance) graficoAvance.destroy();

    graficoAvance = new Chart(ctx, {

        type: "bar",

        data: {
            labels: diasFormateados,
            datasets: [
                {
                    label: "Trabajadores del sector",
                    data: datosTrabajadores,
                    backgroundColor: "#4f7a8c",
                    borderRadius: 4
                },
                {
                    label: "Graduados UArtes",
                    data: datosGraduados,
                    backgroundColor: "#efa000",
                    borderRadius: 4
                }
            ]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: "bottom",
                    labels: { color: colorTexto, font: { family: "'Plus Jakarta Sans', sans-serif" } }
                }
            },
            scales: {
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: { precision: 0, color: colorTexto },
                    grid: { color: colorGrid }
                },
                x: {
                    stacked: true,
                    ticks: { color: colorTexto },
                    grid: { display: false }
                }
            }
        }

    });

}

// ==========================================
// GRÁFICO DE DONA (genérico)
// Sirve para cualquier pregunta select_one o select_multiple.
// ==========================================

let graficosDona = {};

function generarDona(registros, nombreCampo, mapa, idCanvas, tituloDefault, opciones = {}) {

    const conteo = {};

    registros.forEach(encuesta => {

        const valorCrudo = campo(encuesta, nombreCampo);
        if (!valorCrudo) return;

        const valores = opciones.multiple ? String(valorCrudo).split(" ") : [valorCrudo];

        valores.forEach(v => {
            if (!v) return;
            conteo[v] = (conteo[v] || 0) + 1;
        });

    });

    const categorias = Object.keys(conteo);

    const contenedorCanvas = document.getElementById(idCanvas);
    const seccion = contenedorCanvas ? contenedorCanvas.closest(".grafico") : null;

    if (categorias.length === 0) {
        if (seccion) seccion.style.display = "none";
        return;
    }

    if (seccion) seccion.style.display = "block";

    const cantidades = categorias.map(cat => conteo[cat]);
    const etiquetas = categorias.map(cat => mapa[cat] || cat);
    const colores = categorias.map((_, i) => PALETA_MARCA[i % PALETA_MARCA.length]);

    const ctx = document.getElementById(idCanvas);

    if (graficosDona[idCanvas]) graficosDona[idCanvas].destroy();

    const totalGeneral = cantidades.reduce((a, b) => a + b, 0);

    const colorTextoPrincipal = esModoOscuro() ? "#f2f3f5" : "#3c3c3c";
    const colorTextoSecundario = esModoOscuro() ? "#9aa0ab" : "#6b6b6b";

    const textoCentral = {
        id: "textoCentral" + idCanvas,
        beforeDraw(chart) {
            const { ctx, chartArea: { width, height, left, top } } = chart;
            const centroX = left + width / 2;
            const centroY = top + height / 2;

            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            ctx.font = "700 24px 'Plus Jakarta Sans', sans-serif";
            ctx.fillStyle = colorTextoPrincipal;
            ctx.fillText(totalGeneral, centroX, centroY - 8);

            ctx.font = "500 10px 'Plus Jakarta Sans', sans-serif";
            ctx.fillStyle = colorTextoSecundario;
            ctx.fillText("respuestas", centroX, centroY + 12);

            ctx.restore();
        }
    };

    graficosDona[idCanvas] = new Chart(ctx, {

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
                        padding: 10,
                        boxWidth: 12,
                        font: { size: 11, family: "'Plus Jakarta Sans', sans-serif" },
                        color: colorTextoSecundario
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (contexto) {
                            const porcentaje = ((contexto.parsed / totalGeneral) * 100).toFixed(1);
                            return `${contexto.label}: ${contexto.parsed} (${porcentaje}%)`;
                        }
                    }
                }
            }
        }

    });

}

// ==========================================
// TABLA DE CONTEO (genérica)
// ==========================================

function generarTablaConteo(registros, nombreCampo, mapa, idContenedor, tituloColumna) {

    const conteo = {};

    registros.forEach(encuesta => {

        const valorCrudo = campo(encuesta, nombreCampo);
        if (!valorCrudo) return;

        const etiqueta = mapa[valorCrudo] || valorCrudo;
        conteo[etiqueta] = (conteo[etiqueta] || 0) + 1;

    });

    const filas = Object.entries(conteo).sort((a, b) => b[1] - a[1]);

    const contenedor = document.getElementById(idContenedor);
    if (!contenedor) return;

    if (filas.length === 0) {
        contenedor.innerHTML = `<p style="color:#888;font-size:14px;">Aún no hay datos.</p>`;
        return;
    }

    const total = filas.reduce((suma, fila) => suma + fila[1], 0);

    let html = `
        <table class="tabla-datos">
            <thead>
                <tr>
                    <th>${tituloColumna}</th>
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

    html += `</tbody></table>`;

    contenedor.innerHTML = html;

}

// ==========================================
// INGRESOS (promedio y mediana)
// Usa p20 (retribución mensual de la actividad principal),
// solo aplica a quienes trabajan bajo remuneración (p17 = 1 o 2).
// ==========================================

function actualizarIngresos(trabajadores) {

    const valores = trabajadores
        .map(e => Number(campo(e, "p20")))
        .filter(v => !isNaN(v) && v > 0)
        .sort((a, b) => a - b);

    if (valores.length === 0) {
        document.getElementById("ingresoPromedio").textContent = "--";
        document.getElementById("ingresoMediana").textContent = "--";
        return;
    }

    const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;

    const mitad = Math.floor(valores.length / 2);
    const mediana = valores.length % 2 !== 0
        ? valores[mitad]
        : (valores[mitad - 1] + valores[mitad]) / 2;

    document.getElementById("ingresoPromedio").textContent = `$${promedio.toFixed(0)}`;
    document.getElementById("ingresoMediana").textContent = `$${mediana.toFixed(0)}`;

}

// ==========================================
// % VÍCTIMAS DE INSEGURIDAD (p49)
// ==========================================

function actualizarPorcentajeInseguridad(trabajadores) {

    let respondio = 0;
    let siVictima = 0;

    trabajadores.forEach(e => {
        const valor = campo(e, "p49");
        if (!valor) return;
        respondio++;
        if (valor === "1") siVictima++;
    });

    const elemento = document.getElementById("porcentajeInseguridad");

    elemento.textContent = respondio > 0 ? `${((siVictima / respondio) * 100).toFixed(1)}%` : "--";

}

// ==========================================
// % SIN AFILIACIÓN A SEGURO MÉDICO (p41, incluye "5" = Ninguno)
// ==========================================

function actualizarPorcentajeSinSeguro(trabajadores) {

    let respondio = 0;
    let ninguno = 0;

    trabajadores.forEach(e => {
        const valor = campo(e, "p41");
        if (!valor) return;
        respondio++;
        if (String(valor).split(" ").includes("5")) ninguno++;
    });

    const elemento = document.getElementById("porcentajeSinSeguro");

    elemento.textContent = respondio > 0 ? `${((ninguno / respondio) * 100).toFixed(1)}%` : "--";

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

        // Chart.js dibuja su texto directamente sobre el canvas, así que
        // hay que redibujar todos los gráficos con los colores del modo activo.
        if (ultimosDatosCargados) procesarDatos(ultimosDatosCargados);

    });

}
