// ================================
// 📦 Tu Socio Ideal | Inicio
// ================================
import { db } from "./confirebase.js";
import {
  collection,
  getDocs,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ================================
// 🔹 REFERENCIAS AL DOM
// ================================
const citasHoyEl = document.querySelector(".card:nth-child(1) h3");
const cancelacionesEl = document.querySelector(".card:nth-child(2) h3");
const clientesEl = document.querySelector(".card:nth-child(3) h3");
const usuariosActivosEl = document.querySelector(".card:nth-child(4) h3");

const ctxClientes = document.getElementById("chartClientes");
const ctxCancelaciones = document.getElementById("chartCancelaciones");

let graficoClientes = null;
let graficoCancelaciones = null;

// ================================
// 🚀 FUNCIÓN PRINCIPAL
// ================================
async function cargarDatosInicio() {
  try {
    const hoy = new Date().toISOString().split("T")[0];

    // === COLECCIÓN PROGRAMACIONES (CITAS) ===
    const programacionesRef = collection(db, "programaciones");
    const snapshotProgramaciones = await getDocs(programacionesRef);
    let citasHoy = 0;
    snapshotProgramaciones.forEach((doc) => {
      const data = doc.data();
      const fecha = data.fecha?.split("T")[0] || data.fecha;
      if (fecha === hoy && data.estado?.toLowerCase() !== "cancelada") citasHoy++;
    });
    citasHoyEl.textContent = citasHoy;

    // === CANCELACIONES ===
    const cancelacionesRef = collection(db, "cancelaciones");
    const snapshotCancelaciones = await getDocs(cancelacionesRef);
    cancelacionesEl.textContent = snapshotCancelaciones.size;

    // === CLIENTES ===
    const clientesRef = collection(db, "clientes");
    const snapshotClientes = await getDocs(clientesRef);
    clientesEl.textContent = snapshotClientes.size;

    // === USUARIOS ACTIVOS EN TIEMPO REAL ===
    const usuariosActivosRef = collection(db, "usuariosActivos");
    onSnapshot(usuariosActivosRef, (snapshot) => {
      usuariosActivosEl.textContent = snapshot.size;
    });

    // === GRAFICAR ===
    crearGraficos(snapshotClientes, snapshotCancelaciones);

  } catch (error) {
    console.error("❌ Error al cargar datos del panel:", error);
  }
}

// ================================
// 📊 CREAR Y ACTUALIZAR GRÁFICAS
// ================================
function crearGraficos(snapshotClientes, snapshotCancelaciones) {
  const datos = {};

  // Contar clientes por fecha
  snapshotClientes.forEach((doc) => {
    const fecha = doc.data().fecha || "Sin fecha";
    if (!datos[fecha]) datos[fecha] = { clientes: 0, cancelaciones: 0 };
    datos[fecha].clientes++;
  });

  // Contar cancelaciones por fecha
  snapshotCancelaciones.forEach((doc) => {
    const fecha = doc.data().fecha || "Sin fecha";
    if (!datos[fecha]) datos[fecha] = { clientes: 0, cancelaciones: 0 };
    datos[fecha].cancelaciones++;
  });

  const fechasOrdenadas = Object.keys(datos).sort((a, b) => new Date(a) - new Date(b));
  const clientesPorDia = fechasOrdenadas.map((f) => datos[f].clientes);
  const cancelacionesPorDia = fechasOrdenadas.map((f) => datos[f].cancelaciones);

  // === GRÁFICO DE CLIENTES ===
  if (graficoClientes) graficoClientes.destroy();
  graficoClientes = new Chart(ctxClientes, {
    type: "bar",
    data: {
      labels: fechasOrdenadas,
      datasets: [
        {
          label: "Clientes ingresados",
          data: clientesPorDia,
          backgroundColor: "rgba(0, 78, 124, 0.7)",
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } },
      plugins: {
        legend: { labels: { color: "#1E1E2F" } },
      },
    },
  });

  // === GRÁFICO DE CANCELACIONES ===
  if (graficoCancelaciones) graficoCancelaciones.destroy();
  graficoCancelaciones = new Chart(ctxCancelaciones, {
    type: "line",
    data: {
      labels: fechasOrdenadas,
      datasets: [
        {
          label: "Cancelaciones",
          data: cancelacionesPorDia,
          borderColor: "#F4B400",
          backgroundColor: "rgba(244, 180, 0, 0.2)",
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } },
      plugins: {
        legend: { labels: { color: "#1E1E2F" } },
      },
    },
  });
}

// ================================
// 🔹 EJECUCIÓN AUTOMÁTICA
// ================================
document.addEventListener("DOMContentLoaded", cargarDatosInicio);
