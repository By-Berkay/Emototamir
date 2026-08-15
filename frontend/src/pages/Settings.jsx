import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";

const ROLES = [
  { v: "admin", l: "Admin" },
  { v: "service_advisor", l: "Servis Danışmanı" },
  { v: "technician", l: "Teknisyen" },
  { v: "accountant", l: "Muhasebe" },
];

export default function Settings() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email:"", password:"", name:"", role:"service_advisor" });

  useEffect(() => { if (user?.role === "admin") api.get("/users").then(r=>setUsers(r.data)); }, [user]);

  const save = async () => {
    try {
      await api.post("/users", form);
      toast.success("Kullanıcı eklendi");
      setOpen(false); setForm({ email:"", password:"", name:"", role:"service_advisor" });
      api.get("/users").then(r=>setUsers(r.data));
    } catch (e) { toast.error("Kayıt başarısız"); }
  };

  return (
    <div className="space-y-6">
      <div><h1 className="font-heading text-3xl font-bold text-slate-900">Ayarlar</h1></div>

      <Card className="border-slate-200"><CardHeader><CardTitle className="text-base">Hesabım</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div><Label>Ad</Label><Input value={user?.name || ""} disabled /></div>
          <div><Label>E-posta</Label><Input value={user?.email || ""} disabled /></div>
          <div><Label>Rol</Label><Input value={user?.role || ""} disabled /></div>
        </CardContent>
      </Card>

      {user?.role === "admin" && (
        <Card className="border-slate-200">
          <CardHeader className="flex-row justify-between items-center"><CardTitle className="text-base">Personel Yönetimi</CardTitle>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button className="bg-orange-500 hover:bg-orange-600"><Plus className="h-4 w-4 mr-2" />Yeni Kullanıcı</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Yeni Kullanıcı</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2"><Label>Ad</Label><Input value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} /></div>
                  <div><Label>E-posta</Label><Input value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})} /></div>
                  <div><Label>Şifre</Label><Input type="password" value={form.password} onChange={(e)=>setForm({...form, password:e.target.value})} /></div>
                  <div className="col-span-2"><Label>Rol</Label>
                    <Select value={form.role} onValueChange={(v)=>setForm({...form, role:v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ROLES.map(r=><SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button variant="outline" onClick={()=>setOpen(false)}>İptal</Button><Button className="bg-orange-500 hover:bg-orange-600" onClick={save}>Kaydet</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-0">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="text-left px-4 py-2">Ad</th><th className="text-left px-4 py-2">E-posta</th><th className="text-left px-4 py-2">Rol</th></tr></thead>
              <tbody>{users.map(u=><tr key={u.id} className="border-t"><td className="px-4 py-2">{u.name}</td><td className="px-4 py-2">{u.email}</td><td className="px-4 py-2"><span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{u.role}</span></td></tr>)}</tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
