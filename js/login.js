// ============================
// 🔹 Importaciones Firebase
// ============================
import { db } from "./confirebase.js";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ============================
// 🔹 Evento principal
// ============================
window.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  const modalError = document.getElementById("modal-error");
  const errorText = document.getElementById("error-text");
  const cerrarError = document.getElementById("cerrar-error");
  const btnIngresar = document.querySelector(".btn-ingresar");

  // ======== Funciones auxiliares ========

  // Mostrar modal de error
  function mostrarError(mensaje) {
    errorText.textContent = mensaje;
    modalError.classList.add("active");
  }

  // Botón con animación de carga
  function mostrarCargando() {
    btnIngresar.disabled = true;
    btnIngresar.innerHTML = `<span class="material-icons spin">autorenew</span> Verificando...`;
  }

  // Restaurar botón normal
  function restaurarBoton() {
    btnIngresar.disabled = false;
    btnIngresar.textContent = "Iniciar sesión";
  }

  cerrarError.addEventListener("click", () => {
    modalError.classList.remove("active");
  });

  // ======== Evento de envío del formulario ========
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const usuario = document.getElementById("usuario");
    const password = document.getElementById("password");

    const usuarioVal = usuario.value.trim();
    const passwordVal = password.value.trim();

    // Quitar clases de error previas
    usuario.classList.remove("error");
    password.classList.remove("error");

    if (!usuarioVal || !passwordVal) {
      mostrarError("Por favor, ingresa todos los datos.");
      if (!usuarioVal) usuario.classList.add("error");
      if (!passwordVal) password.classList.add("error");
      return;
    }

    mostrarCargando();

    try {
      const empleadosRef = collection(db, "empleados");
      const q = query(empleadosRef, where("nombre", "==", usuarioVal));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        mostrarError("Usuario no encontrado.");
        restaurarBoton();
        return;
      }

      let valido = false;
      let datosUsuario = null;

      snapshot.forEach((docu) => {
        const data = docu.data();
        if (data.contrasena === passwordVal) {
          valido = true;
          datosUsuario = { id: docu.id, ...data };
        }
      });

      if (!valido) {
        mostrarError("Contraseña incorrecta.");
        restaurarBoton();
        return;
      }

      // Guardar usuario en localStorage
      localStorage.setItem("usuarioActivo", JSON.stringify(datosUsuario));
      localStorage.setItem("permisos", JSON.stringify(datosUsuario.permisos));

      // Registrar usuario en colección "usuariosActivos"
      try {
        await addDoc(collection(db, "usuariosActivos"), {
          nombre: datosUsuario.nombre,
          fechaIngreso: new Date().toISOString()
        });
      } catch (err) {
        console.error("Error al registrar usuario activo:", err);
      }

      // Redirigir al panel principal
      window.location.href = "index.html";

    } catch (error) {
      console.error("Error en login:", error);
      mostrarError("Error de conexión. Intenta de nuevo.");
      restaurarBoton();
    }
  });
});

// ============================
// 🔹 Función para cargar permisos desde Firestore
// ============================
export async function cargarPermisosEmpleado() {
  const usuarioActivo = JSON.parse(localStorage.getItem("usuarioActivo"));
  if (!usuarioActivo) {
    alert("No hay sesión activa.");
    window.location.href = "login.html";
    return {};
  }

  try {
    const empleadosRef = collection(db, "empleados");
    const q = query(empleadosRef, where("nombre", "==", usuarioActivo.nombre));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      alert("No se encontró el empleado en la base de datos.");
      return {};
    }

    let permisos = {};
    snapshot.forEach((docu) => {
      permisos = docu.data().permisos || {};
      localStorage.setItem("permisos", JSON.stringify(permisos));
    });

    return permisos;
  } catch (error) {
    console.error("Error al cargar permisos:", error);
    return {};
  }
}

// ============================
// 🔹 Función de cerrar sesión
// ============================
export async function cerrarSesion() {
  const usuarioActivo = JSON.parse(localStorage.getItem("usuarioActivo"));
  if (usuarioActivo) {
    try {
      const q = query(collection(db, "usuariosActivos"), where("nombre", "==", usuarioActivo.nombre));
      const snapshot = await getDocs(q);
      snapshot.forEach(async (docu) => {
        await deleteDoc(doc(db, "usuariosActivos", docu.id));
      });
    } catch (err) {
      console.error("Error al eliminar usuario activo:", err);
    }
  }

  localStorage.removeItem("usuarioActivo");
  localStorage.removeItem("permisos");
  window.location.href = "login.html";
}


