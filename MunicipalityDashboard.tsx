import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, updateDoc, doc, Timestamp, addDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../App';
import { LayoutDashboard, Users, Truck, MessageSquare, ClipboardList, CheckCircle2, Clock, Trash2, Send, AlertTriangle, Plus, MapPin, X, Save, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

interface Report {
  id: string;
  userId: string;
  category: string;
  description: string;
  status: 'pending' | 'assigned' | 'completed';
  timestamp: Timestamp;
  location: { address: string };
  imageUrl?: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  timestamp: Timestamp;
  priority: 'low' | 'normal' | 'high';
}

interface Vehicle {
  id: string;
  vehicleNumber: string;
  status: 'active' | 'idle' | 'maintenance';
  staff: string[];
  location: { lat: number; lng: number };
}

export default function MunicipalityDashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'announcements' | 'fleet'>('overview');
  const [newAnn, setNewAnn] = useState({ title: '', content: '', priority: 'normal' as const });
  
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    vehicleNumber: '',
    status: 'active' as const,
    staff: ''
  });

  useEffect(() => {
    const qReports = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
    const unsubscribeReports = onSnapshot(qReports, (snapshot) => {
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report)));
    });

    const qAnn = query(collection(db, 'announcements'), orderBy('timestamp', 'desc'));
    const unsubscribeAnn = onSnapshot(qAnn, (snapshot) => {
      setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement)));
    });

    const qVehicles = query(collection(db, 'vehicles'), orderBy('vehicleNumber', 'asc'));
    const unsubscribeVehicles = onSnapshot(qVehicles, (snapshot) => {
      setVehicles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle)));
    });

    return () => {
      unsubscribeReports();
      unsubscribeAnn();
      unsubscribeVehicles();
    };
  }, []);

  const updateReportStatus = async (id: string, status: Report['status']) => {
    try {
      await updateDoc(doc(db, 'reports', id), { status });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const deleteReport = async (id: string) => {
    if (confirm('Are you sure you want to delete this report?')) {
      await deleteDoc(doc(db, 'reports', id));
    }
  };

  const postAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'announcements'), {
        ...newAnn,
        timestamp: Timestamp.now()
      });
      setNewAnn({ title: '', content: '', priority: 'normal' });
    } catch (error) {
      console.error("Error posting announcement:", error);
    }
  };

  const registerVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'vehicles'), {
        vehicleNumber: newVehicle.vehicleNumber,
        status: newVehicle.status,
        staff: newVehicle.staff.split(',').map(s => s.trim()).filter(s => s !== ''),
        location: { lat: 12.2958, lng: 76.6394 } // Default to Mysore center
      });
      setIsAddingVehicle(false);
      setNewVehicle({ vehicleNumber: '', status: 'active', staff: '' });
    } catch (error) {
      console.error("Error registering vehicle:", error);
    }
  };

  const updateVehicleStatus = async (id: string, status: Vehicle['status']) => {
    try {
      await updateDoc(doc(db, 'vehicles', id), { status });
    } catch (error) {
      console.error("Error updating vehicle status:", error);
    }
  };

  const deleteVehicle = async (id: string) => {
    if (confirm('Delete this vehicle from fleet?')) {
      await deleteDoc(doc(db, 'vehicles', id));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row gap-8">
      {/* Sidebar Navigation */}
      <div className="w-full md:w-64 space-y-2">
        <button 
          onClick={() => setActiveTab('overview')}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all",
            activeTab === 'overview' ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:bg-slate-100"
          )}
        >
          <LayoutDashboard className="w-5 h-5" />
          Dashboard Overview
        </button>
        <button 
          onClick={() => setActiveTab('reports')}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all",
            activeTab === 'reports' ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:bg-slate-100"
          )}
        >
          <ClipboardList className="w-5 h-5" />
          Staff Activities
          <span className="ml-auto bg-slate-800 text-white text-[10px] px-2 py-0.5 rounded-full">
            {reports.filter(r => r.status === 'pending').length}
          </span>
        </button>
        <button 
          onClick={() => setActiveTab('fleet')}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all",
            activeTab === 'fleet' ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:bg-slate-100"
          )}
        >
          <Truck className="w-5 h-5" />
          Fleet Management
        </button>
        <button 
          onClick={() => setActiveTab('announcements')}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all",
            activeTab === 'announcements' ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:bg-slate-100"
          )}
        >
          <MessageSquare className="w-5 h-5" />
          Broadcasts
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 space-y-6">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div 
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                <div className="relative z-10">
                  <h3 className="text-2xl font-bold mb-2">Municipality Action Center</h3>
                  <p className="text-slate-400">Welcome to the staff portal. Manage urban cleanliness and fleet operations in real-time.</p>
                </div>
                <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-10 translate-y-10">
                  <Truck className="w-64 h-64" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <div className="bg-orange-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                    <Clock className="w-6 h-6 text-orange-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{reports.filter(r => r.status === 'pending').length}</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Pending Reports</div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <div className="bg-green-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                    <Truck className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{vehicles.filter(v => v.status === 'active').length}</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Active Vehicles</div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <div className="bg-blue-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{reports.filter(r => r.status === 'completed').length}</div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Total Cleared</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  Critical Priority Issues
                </h4>
                <div className="space-y-3">
                  {reports.filter(r => r.status === 'pending').slice(0, 3).map(r => (
                    <div key={r.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-red-500 rounded-full" />
                        <span className="text-sm font-bold text-slate-700 capitalize">{r.category} Waste Report</span>
                        {r.imageUrl && <span className="text-[10px] text-blue-500 font-bold flex items-center gap-1"><Camera className="w-3 h-3" /> Image</span>}
                      </div>
                      <span className="text-[10px] text-slate-400">{r.location.address}</span>
                    </div>
                  ))}
                  {reports.filter(r => r.status === 'pending').length === 0 && (
                    <p className="text-sm text-slate-400 italic">No pending critical issues.</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'reports' && (
            <motion.div 
              key="reports"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Staff Action List</h3>
                <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  Showing {reports.length} total concerns
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {reports.map((report) => (
                  <motion.div 
                    layout
                    key={report.id}
                    className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 group"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "p-3 rounded-xl h-fit",
                          report.status === 'completed' ? "bg-green-100 text-green-600" : 
                          report.status === 'assigned' ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600"
                        )}>
                          {report.status === 'completed' ? <CheckCircle2 className="w-6 h-6" /> : 
                           report.status === 'assigned' ? <Truck className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-bold text-slate-900 capitalize">{report.category} Waste</span>
                            <span className="text-[10px] font-bold uppercase py-0.5 px-2 bg-slate-100 text-slate-500 rounded-md">
                              {report.id.slice(0, 8)}
                            </span>
                          </div>
                          <p className="text-slate-600 text-sm mb-3">{report.description}</p>
                          
                          {report.imageUrl && (
                            <div className="mb-4 rounded-2xl overflow-hidden border border-slate-100 max-w-sm">
                              <img 
                                src={report.imageUrl} 
                                alt="Garbage evidence" 
                                className="w-full h-48 object-cover hover:scale-105 transition-transform cursor-pointer"
                                referrerPolicy="no-referrer"
                                onClick={() => window.open(report.imageUrl, '_blank')}
                              />
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                             <div className="flex items-center gap-2 text-xs text-slate-400">
                                <MapPin className="w-3.5 h-3.5" />
                                {report.location.address}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                <Clock className="w-3.5 h-3.5" />
                                {report.timestamp?.toDate().toLocaleString()}
                              </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <select 
                          value={report.status}
                          onChange={(e) => updateReportStatus(report.id, e.target.value as any)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider focus:outline-none transition-all cursor-pointer border",
                            report.status === 'completed' ? "bg-green-50 border-green-200 text-green-700" : 
                            report.status === 'assigned' ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-orange-50 border-orange-200 text-orange-700"
                          )}
                        >
                          <option value="pending">Pending</option>
                          <option value="assigned">Assigned</option>
                          <option value="completed">Completed</option>
                        </select>
                        <button 
                          onClick={() => deleteReport(report.id)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'fleet' && (
            <motion.div 
              key="fleet"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Fleet Management</h3>
                <button 
                  onClick={() => setIsAddingVehicle(true)}
                  className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Register Vehicle
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {vehicles.map(vehicle => (
                  <div key={vehicle.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 group relative">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "p-3 rounded-xl",
                          vehicle.status === 'active' ? "bg-green-100 text-green-600" :
                          vehicle.status === 'maintenance' ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"
                        )}>
                          <Truck className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900">{vehicle.vehicleNumber}</h4>
                          <p className="text-xs text-slate-400">
                            Staff: {vehicle.staff.length > 0 ? vehicle.staff.join(', ') : 'No staff assigned'}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => deleteVehicle(vehicle.id)}
                        className="p-1.5 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          vehicle.status === 'active' ? "bg-green-500 animate-pulse" :
                          vehicle.status === 'maintenance' ? "bg-red-500" : "bg-slate-400"
                        )} />
                        <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                          {vehicle.status}
                        </span>
                      </div>
                      <select 
                        value={vehicle.status}
                        onChange={(e) => updateVehicleStatus(vehicle.id, e.target.value as any)}
                        className="bg-slate-50 text-[10px] font-bold py-1 px-2 rounded-lg border-none focus:ring-0 cursor-pointer text-slate-600"
                      >
                        <option value="active">Active</option>
                        <option value="idle">Idle</option>
                        <option value="maintenance">Maintenance</option>
                      </select>
                    </div>
                  </div>
                ))}
                {vehicles.length === 0 && (
                  <div className="sm:col-span-2 py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 font-medium">
                    No vehicles registered in the fleet.
                  </div>
                )}
              </div>
              
              <div className="h-64 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-400 font-medium relative group overflow-hidden">
                <MapPin className="w-8 h-8 text-slate-300 absolute" />
                <span className="z-10 bg-white/60 backdrop-blur-md px-4 py-2 rounded-full text-xs shadow-sm">
                  Mysore Municipal Tracking (MCC)
                </span>
                <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/map/800/400?grayscale')] opacity-10 bg-cover bg-center" />
                {vehicles.filter(v => v.status === 'active').map((v, idx) => (
                  <motion.div
                    key={v.id}
                    animate={{ 
                      x: [idx * 30, idx * 30 + 10, idx * 30], 
                      y: [idx * 20, idx * 20 - 5, idx * 20] 
                    }}
                    transition={{ repeat: Infinity, duration: 3 + idx }}
                    className="absolute z-20"
                    style={{ left: `${30 + idx * 10}%`, top: `${40 + idx * 5}%` }}
                  >
                    <Truck className="w-5 h-5 text-green-600 drop-shadow-md" />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'announcements' && (
            <motion.div 
              key="ann"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-8"
            >
              {/* Post New */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-slate-900">Broadcast New Notice</h3>
                <form onSubmit={postAnnouncement} className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Subject</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-slate-900 transition-all"
                      placeholder="e.g., Holiday Collection Schedule"
                      value={newAnn.title}
                      onChange={e => setNewAnn({...newAnn, title: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Priority</label>
                    <div className="flex gap-2">
                       {['low', 'normal', 'high'].map(p => (
                         <button
                           key={p}
                           type="button"
                           onClick={() => setNewAnn({...newAnn, priority: p as any})}
                           className={cn(
                             "flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase transition-all border",
                             newAnn.priority === p ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                           )}
                         >
                           {p}
                         </button>
                       ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Content</label>
                    <textarea 
                      className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-slate-900 transition-all resize-none"
                      rows={4}
                      placeholder="Write your announcement here..."
                      value={newAnn.content}
                      onChange={e => setNewAnn({...newAnn, content: e.target.value})}
                      required
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Publish Notice
                  </button>
                </form>
              </div>

              {/* Announcements List */}
              <div className="space-y-4">
                 <h3 className="text-xl font-bold text-slate-900">Current Notices</h3>
                 <div className="space-y-3">
                   {announcements.map(ann => (
                     <div key={ann.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
                        {ann.priority === 'high' && <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />}
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <h4 className="font-bold text-slate-900">{ann.title}</h4>
                          <button 
                            onClick={async () => await deleteDoc(doc(db, 'announcements', ann.id))}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                             <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm text-slate-500 mb-3">{ann.content}</p>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {ann.timestamp?.toDate().toLocaleString()}
                        </span>
                     </div>
                   ))}
                   {announcements.length === 0 && <p className="text-slate-400 text-center py-8">No announcements found.</p>}
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Register Vehicle Modal */}
      <AnimatePresence>
        {isAddingVehicle && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingVehicle(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-3xl shadow-2xl z-[70] p-8 border border-slate-100"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="w-6 h-6 text-slate-900" />
                  Vehicle Registration
                </h3>
                <button onClick={() => setIsAddingVehicle(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <form onSubmit={registerVehicle} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Vehicle Number</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g., KA-09-MC-1234"
                    className="w-full bg-slate-50 border-none rounded-xl py-3.5 px-4 focus:ring-2 focus:ring-slate-900 font-medium"
                    value={newVehicle.vehicleNumber}
                    onChange={e => setNewVehicle({...newVehicle, vehicleNumber: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Initial Status</label>
                  <div className="flex gap-2">
                    {['active', 'idle', 'maintenance'].map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setNewVehicle({...newVehicle, status: s as any})}
                        className={cn(
                          "flex-1 py-2.5 rounded-xl text-xs font-bold uppercase transition-all border",
                          newVehicle.status === s ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-500"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Assign Staff (comma separated)</label>
                  <div className="relative">
                    <Users className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="e.g., Rajesh, Suresh"
                      className="w-full bg-slate-50 border-none rounded-xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-slate-900 font-medium"
                      value={newVehicle.staff}
                      onChange={e => setNewVehicle({...newVehicle, staff: e.target.value})}
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-shadow shadow-lg flex items-center justify-center gap-2 active:scale-95"
                >
                  <Save className="w-5 h-5" />
                  Save Registration
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
