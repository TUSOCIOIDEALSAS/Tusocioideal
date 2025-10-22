// js/programacion.js
// Requiere: confirebase.js que exporte `db`
//           login.js que exporte `cargarPermisosEmpleado`
// Firestore SDK import (v10)
import { db } from "./confirebase.js";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { cargarPermisosEmpleado } from "./login.js";

/* ============================
   REFERENCIAS DOM
   ============================ */
const selectProfesional = document.getElementById("select-profesional");
const fechaInicioInput = document.getElementById("fecha-inicio");
const displayFecha = document.getElementById("display-fecha");
const btnHoy = document.getElementById("btn-fecha-actual");
const btnNuevaCita = document.getElementById("btn-nueva-cita");
const agendaTbody = document.querySelector(".agenda tbody");

const modalNueva = document.getElementById("modal-nueva");
const formNueva = document.getElementById("form-nueva-cita");
const modalNuevaClose = document.getElementById("modal-nueva-close");
const inputNuevaCliente = document.getElementById("nueva-cliente");
const inputNuevaServicio = document.getElementById("nueva-servicio");
const inputNuevaHora = document.getElementById("nueva-hora");
const inputNuevaNotas = document.getElementById("nueva-notas");

const modalDetalle = document.getElementById("modal-detalle");
const modalDetalleClose = document.getElementById("modal-detalle-close");
const detCliente = document.getElementById("det-cliente");
const detServicio = document.getElementById("det-servicio");
const detFechaHora = document.getElementById("det-fecha-hora");
const detProfesional = document.getElementById("det-profesional");
const detEstado = document.getElementById("det-estado");
const btnMarcarAsistio = document.getElementById("btn-marcar-asistio");
const btnAbrirCancel = document.getElementById("btn-abrir-cancel");
const divCancelarDetalle = document.getElementById("div-cancelar-detalle");
const motivoCancelDetalle = document.getElementById("motivo-cancel-detalle");
const btnConfirmCancelDetalle = document.getElementById("btn-confirm-cancel-detalle");

const modalGeneral = document.getElementById("modal-general");
const modalTitle = document.getElementById("modal-title");
const modalMessage = document.getElementById("modal-message");
const modalSearch = document.getElementById("modal-search");

/* Panel derecho rápidas */
const quickProfesional = document.getElementById("quick-profesional");
const quickCliente = document.getElementById("quick-cliente");
const listProximas = document.getElementById("list-proximas");

/* ============================
   ESTADO INTERNO
   ============================ */
let profesionalSeleccionadoId = null;
let profesionalSeleccionadoNombre = null;
let clienteActivo = null; // { id, ... }
let unsubscribeProgramaciones = null;
let appointmentsMap = {}; // id -> data
let selectedDate = new Date(); // fecha mostrada (Date)

/* ============================
   HELPERS FECHA/HORA
   ============================ */
function unsubscribeIfAny() {
  if (unsubscribeProgramaciones) {
    unsubscribeProgramaciones();
    unsubscribeProgramaciones = null;
  }
}

function toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function ymdToDate(ymd) {
  if (!ymd) return null;
  const p = ymd.split("-");
  if (p.length !== 3) return null;
  return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
}

function formatDateHuman(date) {
  return date.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function normalizeFechaField(f) {
  if (!f) return null;
  if (typeof f === "string") {
    if (f.includes("T")) return f.split("T")[0];
    return f;
  }
  if (typeof f.toDate === "function") return toYMD(f.toDate());
  return null;
}

/* ============================
   UTILIDADES UI
   ============================ */
function openModal(modal) {
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
}
function closeModal(modal) {
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
}
// Función para mostrar el modal genérico
function showGeneralModal(title, message) {
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modalSearch.style.display = "none";
  openModal(modalGeneral);
}

/* ------------------------------------
 * 🎯 BOTONES DEL MODAL GENERAL
 * ------------------------------------ */
const confirmBtn = document.getElementById("modal-confirm-global");
const cancelBtn = document.getElementById("modal-cancel-global");

if (confirmBtn && cancelBtn) {
  confirmBtn.onclick = () => {
    // Acción al confirmar
    console.log("Confirmado ✅");
    closeModal(modalGeneral);
  };

  cancelBtn.onclick = () => {
    // Acción al cancelar
    console.log("Cancelado ❌");
    closeModal(modalGeneral);
  };
}

/* ============================
   CARGAR CLIENTE ACTIVO
   ============================ */
async function cargarClienteActivo() {
  try {
    const col = collection(db, "clientesActivos");
    const snap = await getDocs(col);
    if (snap.empty) {
      clienteActivo = null;
      quickCliente.textContent = "—";
      return false;
    }

    let latest = null;
    let time = 0;
    snap.forEach((d) => {
      const data = d.data();
      const t = new Date(data.fechaSeleccion || 0).getTime() || 0;
      if (t >= time) {
        time = t;
        latest = data;
      }
    });

    if (!latest?.idCliente) {
      clienteActivo = null;
      quickCliente.textContent = "—";
      return false;
    }

    const ref = doc(db, "clientes", latest.idCliente);
    const clienteSnap = await getDoc(ref);
    if (!clienteSnap.exists()) {
      clienteActivo = null;
      quickCliente.textContent = "—";
      return false;
    }

    clienteActivo = { id: clienteSnap.id, ...clienteSnap.data() };
    quickCliente.textContent = clienteActivo.nombreEmpresa || clienteActivo.nombre || "—";
    return true;
  } catch (err) {
    console.error("Error cargando cliente activo:", err);
    clienteActivo = null;
    quickCliente.textContent = "—";
    return false;
  }
}

/* ============================
   PROFESIONALES
   ============================ */
function renderProfesionalesOptions(docs) {
  selectProfesional.innerHTML = `<option value="">— Selecciona profesional —</option>`;
  docs.forEach((d) => {
    const data = d.data();
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = data.nombre || data.displayName || `Profesional ${d.id}`;
    selectProfesional.appendChild(opt);
  });
}

function subscribeProfesionales() {
  const ref = collection(db, "profesionales");
  return onSnapshot(ref, (snap) => {
    if (!snap || snap.empty) {
      renderProfesionalesOptions([]);
      return;
    }

    renderProfesionalesOptions(snap.docs);

    if (!profesionalSeleccionadoId && selectProfesional.options.length > 1) {
      const firstOpt = selectProfesional.options[1];
      selectProfesional.value = firstOpt.value;
      profesionalSeleccionadoId = firstOpt.value;
      profesionalSeleccionadoNombre = firstOpt.textContent;
      quickProfesional.textContent = profesionalSeleccionadoNombre;
      subscribeProgramacionesForProfessional(profesionalSeleccionadoId);
    }
  });
}

/* ============================
   AGENDA FILAS
   ============================ */
function generarAgendaFilas() {
  agendaTbody.innerHTML = "";
  for (let h = 8; h <= 18; h++) {
    const horaStr = String(h).padStart(2, "0") + ":00";
    const tr = document.createElement("tr");
    tr.dataset.hora = horaStr;
    const th = document.createElement("th");
    th.textContent = `${h}:00`;
    th.style.width = "110px";
    const td = document.createElement("td");
    td.dataset.time = horaStr;
    td.classList.add("hora-slot");
    td.addEventListener("click", () => handleCellClick(td));
    tr.appendChild(th);
    tr.appendChild(td);
    agendaTbody.appendChild(tr);
  }
}

/* ============================
   RENDER CITAS
   ============================ */
function clearAppointmentsInUI() {
  appointmentsMap = appointmentsMap || {};
  const tds = agendaTbody.querySelectorAll("td.hora-slot");
  tds.forEach((td) => {
    td.textContent = "";
    td.classList.remove("ocupado", "cancelado", "completado");
    delete td.dataset.appId;
  });
}

function renderAppointmentsForDate(dateYMD) {
  clearAppointmentsInUI();
  const tds = agendaTbody.querySelectorAll("td.hora-slot");

  Object.keys(appointmentsMap).forEach((id) => {
    const data = appointmentsMap[id];
    if (normalizeFechaField(data.fecha) !== dateYMD) return;

    const horaStr = (Number(data.hora) < 10 ? `0${Number(data.hora)}` : data.hora) + ":00";
    const td = Array.from(tds).find((t) => t.dataset.time === horaStr);
    if (!td) return;

    td.dataset.appId = id;
    td.textContent = `${data.cliente || data.nombreCliente || 'Sin nombre'} — ${data.servicio || ''}`;
    td.classList.add("ocupado");

    if (data.estado === "cancelado") {
      td.classList.remove("ocupado");
      td.classList.add("cancelado");
    } else if (data.estado === "asistio" || data.estado === "completado") {
      td.classList.remove("ocupado");
      td.classList.add("completado");
    }
  });

  renderProximas(dateYMD);
}

/* ============================
   PRÓXIMAS CITAS
   ============================ */
function renderProximas(dateYMD) {
  listProximas.innerHTML = "";
  const items = Object.values(appointmentsMap)
    .filter(d => normalizeFechaField(d.fecha) === dateYMD && (!d.estado || d.estado === "pendiente"))
    .sort((a, b) => Number(a.hora) - Number(b.hora))
    .slice(0, 5);

  if (!items.length) {
    listProximas.innerHTML = `<li style="color:#666;">No hay próximas citas</li>`;
    return;
  }

  items.forEach(it => {
    const hora = (Number(it.hora) < 10 ? `0${Number(it.hora)}` : it.hora) + ":00";
    const li = document.createElement("li");
    li.textContent = `${hora} — ${it.cliente || it.nombreCliente} (${it.servicio || ''})`;
    listProximas.appendChild(li);
  });
}

/* ============================
   SUSCRIPCIÓN PROGRAMACIONES
   ============================ */
function subscribeProgramacionesForProfessional(profId) {
  if (!profId) return;

  unsubscribeIfAny();
  appointmentsMap = {};

  const ref = collection(db, "programaciones");
  const q = query(ref, where("profesional", "==", profId), orderBy("hora"));

  unsubscribeProgramaciones = onSnapshot(q, snap => {
    if (!snap) return;

    appointmentsMap = {};
    snap.docs.forEach(d => {
      const data = d.data();
      const id = d.id;
      appointmentsMap[id] = {
        id,
        ...data,
        fecha: normalizeFechaField(data.fecha),
        hora: Number(data.hora),
      };
    });

    renderAppointmentsForDate(toYMD(selectedDate));
  }, err => {
    console.error("Error en suscripción programaciones:", err);
    showGeneralModal("Error al sincronizar citas", `Ocurrió un error: ${err.message || ""}`);
  });
}

/* ============================
   CLIC CELDAS
   ============================ */
let lastClickedTimeForNew = null;
function handleCellClick(td) {
  const appId = td.dataset.appId;
  const time = td.dataset.time;
  if (appId) {
    openDetalleCita(appId, appointmentsMap[appId]);
  } else {
    lastClickedTimeForNew = time;
    openModalNueva(time);
  }
}

/* ============================
   MODALES NUEVA / DETALLE
   ============================ */
function openModalNueva(prefillTime = null) {
  inputNuevaHora.value = prefillTime || "";
  inputNuevaCliente.value = clienteActivo ? (clienteActivo.nombreEmpresa || clienteActivo.nombre) : "";
  inputNuevaServicio.value = "";
  inputNuevaNotas.value = "";
  openModal(modalNueva);
}

function openDetalleCita(appId, data) {
  detCliente.textContent = data.cliente || data.nombreCliente || "—";
  detServicio.textContent = data.servicio || "—";
  const fechaDisplay = data.fecha;
  const horaDisplay = (Number(data.hora) < 10 ? `0${Number(data.hora)}` : data.hora) + ":00";
  detFechaHora.textContent = `${fechaDisplay} — ${horaDisplay}`;
  detProfesional.textContent = profesionalSeleccionadoNombre || data.profesional || "—";
  detEstado.textContent = data.estado || "pendiente";
  divCancelarDetalle.style.display = "none";
  motivoCancelDetalle.value = "";
  modalDetalle.dataset.appId = appId;
  openModal(modalDetalle);
}

/* ============================
   GUARDAR NUEVA CITA
   ============================ */
async function guardarNuevaCita(e) {
  e && e.preventDefault();

  const cliente = inputNuevaCliente.value.trim();
  const servicio = inputNuevaServicio.value;
  const horaVal = inputNuevaHora.value;
  const notas = inputNuevaNotas.value.trim();

  if (!profesionalSeleccionadoId) {
    showGeneralModal("Profesional no seleccionado", "Selecciona un profesional antes de agendar.");
    return;
  }
  if (!cliente || !servicio || !horaVal) {
    showGeneralModal("Faltan datos", "Completa cliente, servicio y hora.");
    return;
  }

  const horaNum = Number(horaVal.split(":")[0]);
  const dateYMD = toYMD(selectedDate);

  const conflict = Object.values(appointmentsMap).find(
    d => normalizeFechaField(d.fecha) === dateYMD && Number(d.hora) === horaNum
  );
  if (conflict) {
    showGeneralModal("Hora ocupada", "Ya existe una cita en esa hora.");
    return;
  }

  try {
    await addDoc(collection(db, "programaciones"), {
      cliente,
      servicio,
      profesional: profesionalSeleccionadoId,
      fecha: dateYMD,
      hora: horaNum,
      estado: "pendiente",
      notas: notas || "",
      idCliente: clienteActivo ? clienteActivo.id : null,
      timestamp: serverTimestamp(),
    });
    closeModal(modalNueva);
    showGeneralModal("Cita creada", "La cita se creó correctamente.");
  } catch (err) {
    console.error("Error guardando cita:", err);
    showGeneralModal("Error", "No se pudo guardar la cita. Revisa la consola.");
  }
}

/* ============================
   MARCAR ASISTIÓ
   ============================ */
async function marcarAsistio() {
  const appId = modalDetalle.dataset.appId;
  if (!appId) return;
  try {
    await updateDoc(doc(db, "programaciones", appId), {
      estado: "asistio",
      actualizado: serverTimestamp(),
    });
    closeModal(modalDetalle);
    showGeneralModal("Actualizado", "Cita marcada como asistió.");
  } catch (err) {
    console.error("Error marcando asistio:", err);
    showGeneralModal("Error", "No se pudo actualizar la cita.");
  }
}

/* ============================
   CANCELAR CITA
   ============================ */
async function abrirFormularioCancelar() {
  divCancelarDetalle.style.display = "block";
}

async function confirmarCancelarDetalle() {
  const motivo = motivoCancelDetalle.value.trim();
  if (!motivo) {
    showGeneralModal("Faltan datos", "Ingresa motivo de cancelación.");
    return;
  }
  const appId = modalDetalle.dataset.appId;
  if (!appId) return;

  try {
    const progRef = doc(db, "programaciones", appId);
    await updateDoc(progRef, {
      estado: "cancelado",
      motivoCancelacion: motivo,
      actualizado: serverTimestamp(),
    });

    const original = appointmentsMap[appId] || {};
    await addDoc(collection(db, "cancelaciones"), {
      idProgramacion: appId,
      idCliente: original.idCliente || null,
      cliente: original.cliente || original.nombreCliente || null,
      servicio: original.servicio || null,
      profesional: original.profesional || profesionalSeleccionadoId,
      fecha: normalizeFechaField(original.fecha) || toYMD(selectedDate),
      hora: original.hora || null,
      motivo: motivo,
      timestamp: serverTimestamp(),
    });

    closeModal(modalDetalle);
    showGeneralModal("Cancelada", "La cita fue cancelada y registrada en cancelaciones.");
  } catch (err) {
    console.error("Error cancelando cita:", err);
    showGeneralModal("Error", "No se pudo cancelar la cita. Revisa la consola.");
  }
}

/* ============================
   EVENTOS UI
   ============================ */
function attachEvents() {
  selectProfesional.addEventListener("change", (e) => {
    profesionalSeleccionadoId = e.target.value || null;
    profesionalSeleccionadoNombre = selectProfesional.selectedOptions[0]?.textContent || null;
    quickProfesional.textContent = profesionalSeleccionadoNombre || "—";
    if (profesionalSeleccionadoId) {
      subscribeProgramacionesForProfessional(profesionalSeleccionadoId);
    } else {
      unsubscribeIfAny();
      clearAppointmentsInUI();
    }
  });

  fechaInicioInput.addEventListener("change", (e) => {
    const val = e.target.value;
    if (!val) return;
    selectedDate = new Date(val + "T00:00:00");
    displayFecha.textContent = formatDateHuman(selectedDate);
    renderAppointmentsForDate(toYMD(selectedDate));
  });

  btnHoy.addEventListener("click", () => {
    selectedDate = new Date();
    fechaInicioInput.value = toYMD(selectedDate);
    displayFecha.textContent = formatDateHuman(selectedDate);
    renderAppointmentsForDate(toYMD(selectedDate));
  });

  btnNuevaCita.addEventListener("click", () => openModalNueva(lastClickedTimeForNew));
  modalNuevaClose.addEventListener("click", () => closeModal(modalNueva));
  formNueva.addEventListener("submit", guardarNuevaCita);

  modalDetalleClose.addEventListener("click", () => closeModal(modalDetalle));
  btnMarcarAsistio.addEventListener("click", marcarAsistio);
  btnAbrirCancel.addEventListener("click", abrirFormularioCancelar);
  btnConfirmCancelDetalle.addEventListener("click", confirmarCancelarDetalle);
}

/* ============================
   INICIALIZACIÓN
   ============================ */
function init() {
  fechaInicioInput.value = toYMD(selectedDate);
  displayFecha.textContent = formatDateHuman(selectedDate);
  generarAgendaFilas();
  attachEvents();
  cargarClienteActivo();
  subscribeProfesionales();
}

init();








