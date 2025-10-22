// ======================
// 🔹 CONFIGURACIÓN.JS
// ======================
import { db } from "./confirebase.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc // 🔹 <--- AGREGA ESTO
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ========== REFERENCIAS A ELEMENTOS ========== */
const modalProfesional = document.getElementById("modal-profesional");
const modalEmpleado = document.getElementById("modal-empleado");
const btnAgregarProfesional = document.getElementById("btn-agregar-profesional");
const btnAgregarEmpleado = document.getElementById("btn-agregar-empleado");
const btnCerrarProfesional = document.getElementById("modal-profesional-close");
const btnCerrarEmpleado = document.getElementById("modal-empleado-close");

const formProfesional = document.getElementById("form-profesional");
const formEmpleado = document.getElementById("form-empleado");
const listaProfesionales = document.getElementById("lista-profesionales");
const selectBloqProfesional = document.getElementById("bloq-profesional");
const tablaPermisosBody = document.getElementById("tabla-permisos-body");

/* ========== VALIDAR SESIÓN ACTIVA ========== */
const usuarioActual = localStorage.getItem("usuarioActivo"); // antes era usuarioActual
const permisosGuardados = localStorage.getItem("permisos");

if (!usuarioActual || !permisosGuardados) {
  alert("No hay sesión activa. Inicia sesión nuevamente.");
  window.location.href = "login.html";
}

const permisosUsuario = JSON.parse(permisosGuardados);
if (!permisosUsuario.configuracion && !permisosUsuario.crearUsuarios) {
  alert("No tienes permiso para acceder a esta sección.");
  window.location.href = "index.html";
}

/* ========== FUNCIONES DE MODALES ========== */
btnAgregarProfesional.addEventListener("click", () => {
  modalProfesional.classList.add("active");
});
btnCerrarProfesional.addEventListener("click", () => {
  modalProfesional.classList.remove("active");
});

btnAgregarEmpleado.addEventListener("click", () => {
  modalEmpleado.classList.add("active");
});
btnCerrarEmpleado.addEventListener("click", () => {
  modalEmpleado.classList.remove("active");
});

/* ========== GUARDAR PROFESIONAL ========== */
formProfesional.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nombre = document.getElementById("nombre-profesional").value.trim();

  if (!nombre) return alert("Por favor ingresa el nombre del profesional.");

  try {
    await addDoc(collection(db, "profesionales"), { nombre });
    alert("✅ Profesional agregado correctamente.");
    formProfesional.reset();
    modalProfesional.classList.remove("active");
    cargarProfesionales();
  } catch (err) {
    console.error("Error al agregar profesional:", err);
    alert("Error al guardar el profesional.");
  }
});

/* ========== GUARDAR EMPLEADO ========== */
formEmpleado.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nombre = document.getElementById("nombre-empleado").value.trim();
  const contrasena = document.getElementById("contrasena-empleado").value.trim();

  const permisos = {
    clientes: document.getElementById("perm-clientes").checked,
    informes: document.getElementById("perm-informes").checked,
    programacion: document.getElementById("perm-programacion").checked,
    facturacion: document.getElementById("perm-facturacion").checked,
    adjuntos: document.getElementById("perm-adjuntos").checked,
    gestion_clientes: document.getElementById("perm-gestion-clientes").checked,
    configuracion: document.getElementById("perm-configuracion").checked,
    crearUsuarios: document.getElementById("perm-crearUsuarios").checked
  };

  try {
    const editId = formEmpleado.dataset.editId;
    if (editId) {
      // Actualizar
      await updateDoc(doc(db, "empleados", editId), { nombre, contrasena, permisos });
      delete formEmpleado.dataset.editId; // limpiar
      alert("✅ Permisos actualizados correctamente.");
    } else {
      // Crear nuevo
      await addDoc(collection(db, "empleados"), { nombre, contrasena, permisos });
      alert("✅ Empleado creado correctamente.");
    }
    formEmpleado.reset();
    modalEmpleado.classList.remove("active");
    cargarEmpleados();
  } catch (err) {
    console.error(err);
    alert("Error al guardar empleado.");
  }
});

/* ========== CARGAR PROFESIONALES ========== */
async function cargarProfesionales() {
  listaProfesionales.innerHTML = "";
  selectBloqProfesional.innerHTML = `<option value="">Seleccionar profesional</option>`;

  const querySnap = await getDocs(collection(db, "profesionales"));
  querySnap.forEach((docu) => {
    const data = docu.data();
    const li = document.createElement("li");
    li.textContent = data.nombre;
    li.classList.add("prof-item");

    const btnEliminar = document.createElement("button");
    btnEliminar.textContent = "🗑️";
    btnEliminar.style.marginLeft = "10px";
    btnEliminar.addEventListener("click", async () => {
      if (confirm("¿Eliminar este profesional?")) {
        await deleteDoc(doc(db, "profesionales", docu.id));
        cargarProfesionales();
      }
    });

    li.appendChild(btnEliminar);
    listaProfesionales.appendChild(li);

    const option = document.createElement("option");
    option.value = docu.id;
    option.textContent = data.nombre;
    selectBloqProfesional.appendChild(option);
  });
}

// --------------------
// 🔹 Botón Editar Permisos
// --------------------
async function cargarEmpleados() {
  tablaPermisosBody.innerHTML = "";
  const querySnap = await getDocs(collection(db, "empleados"));

  querySnap.forEach((docu) => {
    const data = docu.data();
    const tr = document.createElement("tr");

    const tdNombre = document.createElement("td");
    tdNombre.textContent = data.nombre;
    tr.appendChild(tdNombre);

    const permisos = data.permisos || {};
    const modulos = [
      "clientes",
      "informes",
      "programacion",
      "facturacion",
      "adjuntos",
      "gestion_clientes",
      "configuracion",
      "crearUsuarios"
    ];

    modulos.forEach((mod) => {
      const td = document.createElement("td");
      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = permisos[mod] || false;
      check.disabled = true;
      td.appendChild(check);
      tr.appendChild(td);
    });

    // Botón Editar
    const tdEditar = document.createElement("td");
    const btnEditar = document.createElement("button");
    btnEditar.textContent = "✏️";
    btnEditar.classList.add("btn-editar");
    btnEditar.addEventListener("click", () => {
      // Abrir modal
      modalEmpleado.classList.add("active");
      // Rellenar formulario
      document.getElementById("nombre-empleado").value = data.nombre;
      document.getElementById("contrasena-empleado").value = data.contrasena || "";

      document.getElementById("perm-clientes").checked = permisos.clientes || false;
      document.getElementById("perm-informes").checked = permisos.informes || false;
      document.getElementById("perm-programacion").checked = permisos.programacion || false;
      document.getElementById("perm-facturacion").checked = permisos.facturacion || false;
      document.getElementById("perm-adjuntos").checked = permisos.adjuntos || false;
      document.getElementById("perm-gestion-clientes").checked = permisos.gestion_clientes || false;
      document.getElementById("perm-configuracion").checked = permisos.configuracion || false;
      document.getElementById("perm-crearUsuarios").checked = permisos.crearUsuarios || false;

      // Guardar id del empleado para actualizar
      formEmpleado.dataset.editId = docu.id;
    });
    tdEditar.appendChild(btnEditar);
    tr.appendChild(tdEditar);

    // Botón eliminar
    const tdEliminar = document.createElement("td");
    const btnEliminar = document.createElement("button");
    btnEliminar.textContent = "🗑️";
    btnEliminar.classList.add("btn-danger");
    btnEliminar.addEventListener("click", async () => {
      if (confirm("¿Eliminar este empleado?")) {
        await deleteDoc(doc(db, "empleados", docu.id));
        cargarEmpleados();
      }
    });
    tdEliminar.appendChild(btnEliminar);
    tr.appendChild(tdEliminar);

    tablaPermisosBody.appendChild(tr);
  });
}

/* ========== INICIALIZAR ========== */
window.addEventListener("DOMContentLoaded", () => {
  cargarProfesionales();
  cargarEmpleados();
});

