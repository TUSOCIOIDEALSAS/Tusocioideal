import { db } from "./confirebase.js";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  getDocs, // 👈 agrega esto
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ===============================
// 🔹 VARIABLES Y ELEMENTOS DEL DOM
// ===============================
const listaCitas = document.querySelector("#citas tbody");
const listaCancelaciones = document.querySelector("#cancelaciones tbody");
const listaInformes = document.querySelector("#informes tbody");
const listaArchivos = document.querySelector("#archivos tbody");
const subBtns = document.querySelectorAll(".sub-btn");
const subSections = document.querySelectorAll(".sub-section");

let clienteActual = null;
let clienteActualNit = null;
let clienteActualId = null;

let unsubCitas = null;
let unsubCancel = null;
let unsubInformes = null;
let unsubArchivos = null;

// ===============================
// 🔹 MOSTRAR CLIENTE ACTIVO
// ===============================
function mostrarCliente(c) {
  const card = document.getElementById("resumen");
  card.innerHTML = `
    <h2>Resumen del Cliente</h2>
    <p><strong>Empresa:</strong> ${c.nombreEmpresa || c.nombre || "Sin Empresa"}</p>
    <p><strong>NIT:</strong> ${c.nit || "N/A"}</p>
    <p><strong>Contacto:</strong> ${c.primerNombre || ""} ${c.primerApellido || ""}</p>
    <p><strong>Correo:</strong> ${c.correo || ""}</p>
    <p><strong>Teléfono:</strong> ${c.telefono || ""}</p>
    <p><strong>Dirección:</strong> ${c.direccion || "N/A"}</p>
  `;
  console.log("✅ Cliente activo mostrado:", c.nit || c.nombre);
}

// ===============================
// 🔹 ESCUCHAR CLIENTE ACTIVO
// ===============================
function escucharClienteActivo() {
  const ref = collection(db, "clientesActivos");

  onSnapshot(ref, (snapshot) => {
    if (snapshot.empty) {
      mostrarCliente({ nombre: "No hay cliente activo" });
      limpiarTablas();
      clienteActual = null;
      clienteActualNit = null;
      clienteActualId = null;
      return;
    }

    let clienteActivo = null;
    let ultimaFecha = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      const fecha = new Date(data.fechaSeleccion || 0).getTime();
      if (fecha > ultimaFecha) {
        ultimaFecha = fecha;
        clienteActivo = data;
      }
    });

    if (!clienteActivo?.nit) {
      console.warn("⚠️ No se encontró NIT en el cliente activo.");
      return;
    }

    const clienteQuery = query(
      collection(db, "clientes"),
      where("nit", "==", clienteActivo.nit)
    );

    onSnapshot(clienteQuery, (snap) => {
      if (snap.empty) {
        console.warn("⚠️ Cliente no encontrado en la colección 'clientes'.");
        return;
      }

      clienteActual = snap.docs[0].data();
      clienteActualNit = clienteActual.nit;
      clienteActualId = snap.docs[0].id;

      console.log("🟢 Cliente activo detectado:", clienteActual.nombre || clienteActualNit);
      mostrarCliente(clienteActual);
      cargarTodo();
    });
  });
}

// ===============================
// 🔹 CARGAR TODO
// ===============================
function cargarTodo() {
  console.log("🔄 Cargando datos de cliente:", clienteActualNit, clienteActualId);
  cargarCitas();
  cargarCancelaciones();
  cargarInformes();
  cargarArchivos();
  actualizarCards(); // 👈 Aquí
}

// ===============================
// 🔹 LIMPIAR TABLAS
// ===============================
function limpiarTablas() {
  if (listaCitas) listaCitas.innerHTML = "<tr><td colspan='5'>No hay citas</td></tr>";
  if (listaCancelaciones) listaCancelaciones.innerHTML = "<tr><td colspan='5'>No hay cancelaciones</td></tr>";
  if (listaInformes) listaInformes.innerHTML = "<tr><td colspan='5'>No hay informes</td></tr>";
  if (listaArchivos) listaArchivos.innerHTML = "<tr><td colspan='5'>No hay archivos</td></tr>";
}

// ===============================
// 🔹 ACTUALIZAR CARDS DE MÉTRICAS
// ===============================
async function actualizarCards() {
  if (!clienteActualNit || !clienteActualId) return;

  try {
    // 🔹 Total Citas
    const citasSnap = await getDocs(
      query(collection(db, "programaciones"), where("idCliente", "==", clienteActualId))
    );
    document.getElementById("total-citas").textContent = citasSnap.size;

    // 🔹 Total Informes
    const informesSnap = await getDocs(
      query(collection(db, "database"), where("idCliente", "==", clienteActualId))
    );
    document.getElementById("total-informes").textContent = informesSnap.size;

    // 🔹 Total Archivos
    const archivosSnap = await getDocs(
      query(collection(db, "adjuntos"), where("nit", "==", clienteActualNit))
    );
    document.getElementById("total-archivos").textContent = archivosSnap.size;

    // 🔹 Atenciones del mes (citas del mes actual)
    let atencionesMes = 0;
    const mesActual = new Date().getMonth();
    const anioActual = new Date().getFullYear();

    citasSnap.forEach((doc) => {
      const c = doc.data();
      const fecha = c.fecha ? new Date(c.fecha) : null;
      if (fecha && fecha.getMonth() === mesActual && fecha.getFullYear() === anioActual) {
        atencionesMes++;
      }
    });

    document.getElementById("total-atenciones").textContent = atencionesMes;
  } catch (error) {
    console.error("❌ Error al actualizar cards:", error);
  }
}

// ===============================
// 🔹 CARGAR CITAS
// ===============================
function cargarCitas() {
  if (!clienteActualId) return;
  if (unsubCitas) unsubCitas();

  const q = query(
    collection(db, "programaciones"),
    where("idCliente", "==", clienteActualId)
  );

  unsubCitas = onSnapshot(q, async (snap) => {
    listaCitas.innerHTML = "";

    if (snap.empty) {
      listaCitas.innerHTML = "<tr><td colspan='5'>No hay citas</td></tr>";
      console.log("ℹ️ No se encontraron citas para", clienteActualId);
      return;
    }

    console.log("📅 Citas encontradas:", snap.size);

    for (const docu of snap.docs) {
      const c = docu.data();

      let nombreProfesional = "Desconocido";

      // 🔍 Buscar nombre del profesional en la colección "profesionales"
      if (c.profesional) {
        try {
          const profRef = doc(db, "profesionales", c.profesional);
          const profSnap = await getDoc(profRef);
          if (profSnap.exists()) {
            const datosProf = profSnap.data();
            nombreProfesional = datosProf.nombre || "Sin nombre";
          }
        } catch (error) {
          console.error("⚠️ Error al obtener profesional:", error);
        }
      }

      const fila = document.createElement("tr");
      fila.innerHTML = `
        <td>${c.fecha}</td>
        <td>${c.hora}</td>
        <td>${nombreProfesional}</td>
        <td>${c.servicio}</td>
        <td>${c.estado || "Pendiente"}</td>
      `;
      listaCitas.appendChild(fila);
    }
  });
}

// ===============================
// 🔹 CARGAR CANCELACIONES
// ===============================
async function cargarCancelaciones() {
  if (!clienteActualId) return;
  if (unsubCancel) unsubCancel();

  const q = query(
    collection(db, "cancelaciones"),
    where("idCliente", "==", clienteActualId)
  );

  unsubCancel = onSnapshot(q, async (snap) => {
    listaCancelaciones.innerHTML = "";

    if (snap.empty) {
      listaCancelaciones.innerHTML = "<tr><td colspan='5'>No hay cancelaciones</td></tr>";
      console.log("ℹ️ No hay cancelaciones para", clienteActualId);
      return;
    }

    console.log("❌ Cancelaciones encontradas:", snap.size);

    // iteramos en orden y esperamos la resolución de las búsquedas de profesionales
    for (const docu of snap.docs) {
      const c = docu.data();

      let nombreProfesional = "Desconocido";
      if (c.profesional) {
        try {
          const profRef = doc(db, "profesionales", c.profesional);
          const profSnap = await getDoc(profRef);
          if (profSnap.exists()) {
            const datosProf = profSnap.data();
            nombreProfesional = datosProf.nombre || `${datosProf.primerNombre || ""} ${datosProf.primerApellido || ""}`.trim() || "Sin nombre";
          }
        } catch (error) {
          console.error("⚠️ Error al obtener profesional (cancelaciones):", error);
        }
      }

      const motivo = c.motivo || c.motivoCancelacion || "Sin motivo";

      const fila = document.createElement("tr");
      fila.innerHTML = `
        <td>${c.fecha}</td>
        <td>${c.hora}</td>
        <td>${nombreProfesional}</td>
        <td>${motivo}</td>
        <td>${c.servicio || ""}</td>
      `;
      listaCancelaciones.appendChild(fila);
    }
  });
}

// ===============================
// 🔹 CARGAR INFORMES
// ===============================
function cargarInformes() {
  if (!clienteActualId) return;
  if (unsubInformes) unsubInformes();

  const q = query(collection(db, "database"), where("idCliente", "==", clienteActualId));

  unsubInformes = onSnapshot(q, (snap) => {
    listaInformes.innerHTML = "";
    if (snap.empty) {
      listaInformes.innerHTML = "<tr><td colspan='5'>No hay informes</td></tr>";
      console.log("ℹ️ No hay informes para", clienteActualId);
      return;
    }

    console.log("🧾 Informes encontrados:", snap.size);
    snap.forEach((doc) => {
      const i = doc.data();
      const fila = document.createElement("tr");
      fila.innerHTML = `
        <td>${i.nombreCliente}</td>
        <td>${i.servicio}</td>
        <td>${i.fecha}</td>
        <td>${i.nivelUrgencia}</td>
        <td>${i.responsable}</td>
      `;
      listaInformes.appendChild(fila);
    });
  });
}

// ===============================
// 🔹 CARGAR ARCHIVOS
// ===============================
function cargarArchivos() {
  if (!clienteActualNit) return;
  if (unsubArchivos) unsubArchivos();

  const q = query(collection(db, "adjuntos"), where("nit", "==", clienteActualNit));

  unsubArchivos = onSnapshot(q, (snap) => {
    listaArchivos.innerHTML = "";
    if (snap.empty) {
      listaArchivos.innerHTML = "<tr><td colspan='4'>No hay archivos</td></tr>";
      console.log("ℹ️ No hay archivos para", clienteActualNit);
      return;
    }

    console.log("📎 Archivos encontrados:", snap.size);
    snap.forEach((doc) => {
      const a = doc.data();
      const fecha = a.fecha?.toDate ? a.fecha.toDate().toLocaleString() : a.fecha || "Sin fecha";

      const fila = document.createElement("tr");
      fila.innerHTML = `
        <td>${a.cliente}</td>
        <td>${a.descripcion}</td>
        <td>${a.empleado}</td>
        <td>${fecha}</td>
      `;
      listaArchivos.appendChild(fila);
    });
  });
}

// ===============================
// 🔹 EVENTOS DE SECCIONES
// ===============================
subBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const section = btn.dataset.section;
    subSections.forEach((s) => (s.style.display = "none"));
    document.getElementById(section).style.display = "block";

    subBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

// ===============================
// 🔹 INICIO
// ===============================
window.addEventListener("DOMContentLoaded", () => {
  escucharClienteActivo();
  document.getElementById("resumen").style.display = "block";
  console.log("🚀 Script de administración iniciado correctamente");
});



