import React from "react";
import { Navigate } from "react-router-dom";

/** Şifre değiştirme artık Profilim ekranında (giriş bilgileriyle birlikte). */
export default function ChangePassword() {
  return <Navigate to="/profil" replace />;
}
