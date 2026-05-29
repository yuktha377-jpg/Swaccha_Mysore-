import React, { useState, useEffect } from 'react';
import { db, storage } from '../lib/firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../App';
import { MapPin, Camera, Send, Clock, CheckCircle2, AlertCircle, Info, Truck, UserCircle, Edit3, Save, X, Star, MessageSquare, Upload, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

interface Report {
  id: string;
  category: string;
  description: string;
  status: 'pending' | 'assigned' | 'completed';
  timestamp: Timestamp;
  location: { address: string };
  imageUrl?: string;
  feedback?: {
    rating: number;
    comment: string;
    timestamp: Timestamp;
  };
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  timestamp: Timestamp;
  priority: 'low' | 'normal' | 'high';
}

export default function CitizenDashboard() {
  const { user, profile } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isReporting, setIsReporting] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [feedbackReportId, setFeedbackReportId] = useState<string | null>(null);
  const [feedbackForm, setFeedbackForm] = useState({ rating: 5, comment: '' });
  const [newReport, setNewReport] = useState({
    category: 'dry',
    description: '',
    address: '',
    imageUrl: '',
    lat: 12.2958,
    lng: 76.6394
  });

  const [editProfileData, setEditProfileData] = useState({
    name: '',
    area: '',
    photoUrl: ''
  });
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationPermitted, setLocationPermitted] = useState<boolean | null>(null);

  const videoRef = React.useRef<HTMLVideoElement>(null);

  const startCamera = async () => {
    setCameraError(null);
    setIsCameraActive(true);
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.error("Camera access failed:", err);
        setCameraError("Cannot access live camera interface. Please upload an image directly instead.");
        setIsCameraActive(false);
      }
    }, 120);
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const captureSnapshot = () => {
    if (!videoRef.current || !user) return;

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        setIsUploading(true);
        canvas.toBlob(async (blob) => {
          if (!blob) {
            setIsUploading(false);
            return;
          }

          const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
          const storageRef = ref(storage, `reports/${user.uid}/${Date.now()}_camera.jpg`);
          const uploadTask = uploadBytesResumable(storageRef, file);

          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            (error) => {
              console.error("Camera upload failed", error);
              setIsUploading(false);
              setUploadProgress(null);
            },
            async () => {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              setNewReport(prev => ({ ...prev, imageUrl: downloadURL }));
              setIsUploading(false);
              setUploadProgress(null);
              stopCamera();
            }
          );
        }, 'image/jpeg', 0.85);
      }
    } catch (e) {
      console.error("Capture snapshot failed", e);
      setIsUploading(false);
    }
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocationPermitted(true);

        // Standard address placeholder with clean info
        let resolvedAddress = `Latitude: ${latitude.toFixed(5)}, Longitude: ${longitude.toFixed(5)}`;
        
        try {
          // If Google Maps key is available, use Geocoding API from Google
          const mapsKey = process.env.GOOGLE_MAPS_PLATFORM_KEY;
          if (mapsKey) {
            const response = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${mapsKey}`
            );
            const data = await response.json();
            if (data.status === 'OK' && data.results?.[0]) {
              resolvedAddress = data.results[0].formatted_address;
            }
          } else {
            // Fallback reverse geocoding via OpenStreetMap Nominatim
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18`
            );
            const data = await response.json();
            if (data && data.display_name) {
              resolvedAddress = data.display_name;
            }
          }
        } catch (error) {
          console.error("Failed Google/OSM Reverse Geocoding lookup:", error);
        }

        setNewReport(prev => ({
          ...prev,
          address: resolvedAddress,
          lat: latitude,
          lng: longitude
        }));
        setIsLocating(false);
      },
      (error) => {
        console.error("Browser location response error:", error);
        setLocationPermitted(false);
        setIsLocating(false);
        alert("Location authorization declined. Please enter address details manually.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleCloseReportModal = () => {
    stopCamera();
    setIsReporting(false);
  };

  useEffect(() => {
    if (profile) {
      setEditProfileData({
        name: profile.name || '',
        area: profile.area || '',
        photoUrl: profile.photoUrl || ''
      });
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'reports'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribeReports = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
      setReports(data);
    });

    const qAnnouncements = query(
      collection(db, 'announcements'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribeAnnouncements = onSnapshot(qAnnouncements, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
      setAnnouncements(data);
    });

    return () => {
      unsubscribeReports();
      unsubscribeAnnouncements();
    };
  }, [user]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const storageRef = ref(storage, `reports/${user.uid}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    setIsUploading(true);
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error("Upload failed", error);
        setIsUploading(false);
        setUploadProgress(null);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        setNewReport({ ...newReport, imageUrl: downloadURL });
        setIsUploading(false);
        setUploadProgress(null);
      }
    );
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      await addDoc(collection(db, 'reports'), {
        userId: user.uid,
        category: newReport.category,
        description: newReport.description,
        status: 'pending',
        timestamp: Timestamp.now(),
        imageUrl: newReport.imageUrl,
        location: {
          lat: newReport.lat || 12.2958,
          lng: newReport.lng || 76.6394,
          address: newReport.address
        }
      });
      setIsReporting(false);
      setNewReport({ category: 'dry', description: '', address: '', imageUrl: '', lat: 12.2958, lng: 76.6394 });
    } catch (error) {
      console.error("Error submitting report:", error);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        name: editProfileData.name,
        area: editProfileData.area,
        photoUrl: editProfileData.photoUrl
      });
      setIsEditingProfile(false);
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !feedbackReportId) return;

    try {
      const reportRef = doc(db, 'reports', feedbackReportId);
      await updateDoc(reportRef, {
        feedback: {
          rating: feedbackForm.rating,
          comment: feedbackForm.comment,
          timestamp: Timestamp.now()
        }
      });
      setFeedbackReportId(null);
      setFeedbackForm({ rating: 5, comment: '' });
    } catch (error) {
      console.error("Error submitting feedback:", error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Hero Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-stretch">
        <div className="md:col-span-3 bg-green-600 rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden shadow-2xl">
          <div className="relative z-10 max-w-2xl">
            <h2 className="text-4xl font-bold mb-4">Clean Mysore, Green Mysore</h2>
            <p className="text-green-50 text-lg mb-8">Reporting garbage issues helps the municipal office keep our city beautiful. Report now, and we'll take care of it.</p>
            <button 
              onClick={() => setIsReporting(true)}
              className="bg-white text-green-700 px-8 py-4 rounded-2xl font-bold shadow-lg hover:bg-green-50 transition-colors active:scale-95 flex items-center gap-2"
            >
              <AlertCircle className="w-5 h-5" />
              Report Garbage Issue
            </button>
          </div>
          <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-10 translate-y-10">
            <Trash2Icon className="w-96 h-96" />
          </div>
        </div>

        {/* User Quick Profile Card */}
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 flex flex-col items-center justify-center text-center space-y-4">
          <div className="relative">
            {profile?.photoUrl ? (
              <img 
                src={profile.photoUrl} 
                alt={profile.name} 
                className="w-24 h-24 rounded-full object-cover border-4 border-green-100"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center border-4 border-slate-50">
                <UserCircle className="w-12 h-12 text-slate-300" />
              </div>
            )}
            <button 
              onClick={() => setIsEditingProfile(true)}
              className="absolute bottom-0 right-0 p-2 bg-slate-900 text-white rounded-full shadow-lg hover:bg-slate-800 transition-colors"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-lg">{profile?.name}</h3>
            <p className="text-slate-500 text-sm flex items-center justify-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {profile?.area || 'Address not set'}
            </p>
          </div>
          <button 
            onClick={() => setIsEditingProfile(true)}
            className="w-full py-2.5 px-4 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
          >
            Edit Profile
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Reports History */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-500" />
              Your Recent Reports
            </h3>
          </div>
          
          <div className="space-y-4">
            {reports.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-200">
                <Info className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No reports submitted yet.</p>
              </div>
            ) : (
              reports.map((report) => (
                <motion.div 
                  key={report.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4"
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "p-3 rounded-xl",
                      report.status === 'completed' ? "bg-green-100 text-green-600" : 
                      report.status === 'assigned' ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600"
                    )}>
                      {report.status === 'completed' ? <CheckCircle2 className="w-6 h-6" /> : 
                       report.status === 'assigned' ? <Truck className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 capitalize">{report.category} Waste</span>
                        <span className="text-sm text-slate-400">{report.timestamp?.toDate().toLocaleDateString()}</span>
                      </div>
                      <p className="text-slate-600 text-sm mb-3">{report.description}</p>
                      
                      {report.imageUrl && (
                        <div className="mb-3 rounded-xl overflow-hidden border border-slate-100">
                          <img 
                            src={report.imageUrl} 
                            alt="Garbage report" 
                            className="w-full h-48 object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <MapPin className="w-3.5 h-3.5" />
                        {report.location.address}
                      </div>
                    </div>
                    <div className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                      report.status === 'completed' ? "bg-green-50 text-green-700" : 
                      report.status === 'assigned' ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"
                    )}>
                      {report.status}
                    </div>
                  </div>

                  {report.status === 'completed' && (
                    <div className="pt-4 border-t border-slate-50">
                      {report.feedback ? (
                        <div className="bg-slate-50 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex text-orange-400">
                              {[...Array(5)].map((_, i) => (
                                <Star 
                                  key={i} 
                                  className={cn("w-3.5 h-3.5 fill-current", i >= report.feedback!.rating && "text-slate-200 fill-none")} 
                                />
                              ))}
                            </div>
                            <span className="text-xs font-bold text-slate-400 uppercase">Service Rated</span>
                          </div>
                          <p className="text-sm text-slate-600 italic">"{report.feedback.comment}"</p>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setFeedbackReportId(report.id)}
                          className="w-full py-2.5 px-4 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                        >
                          <Star className="w-4 h-4 text-orange-400 fill-current" />
                          Rate Our Service
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Announcements sidebar */}
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Info className="w-5 h-5 text-slate-500" />
            Public Notices
          </h3>
          <div className="space-y-4">
            {announcements.map((ann) => (
              <div key={ann.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
                {ann.priority === 'high' && <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />}
                <h4 className="font-bold text-slate-900 mb-2">{ann.title}</h4>
                <p className="text-slate-600 text-sm mb-4">{ann.content}</p>
                <span className="text-xs text-slate-400 block">{ann.timestamp?.toDate().toLocaleString()}</span>
              </div>
            ))}
            {announcements.length === 0 && (
              <p className="text-slate-400 text-sm text-center">No active announcements.</p>
            )}
          </div>
          
          <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl">
            <h4 className="font-bold mb-2 flex items-center gap-2">
              <Truck className="w-5 h-5 text-green-400" />
              Live Collection Status
            </h4>
            <p className="text-slate-400 text-sm mb-4">Vehicles are currently active in Mysore Central and Hebbal industrial area.</p>
            <div className="bg-slate-800 rounded-xl p-4 flex items-center justify-between">
              <span className="text-xs font-mono">VH-2938 (MCC)</span>
              <span className="flex items-center gap-1.5 text-xs text-green-400 font-bold">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                In Transit
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Report Modal */}
      <AnimatePresence>
        {isReporting && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseReportModal}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-3xl shadow-2xl z-[70] p-8 border border-slate-100"
            >
              <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-green-600" />
                Submit a Report
              </h3>
              <form onSubmit={handleSubmitReport} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Category</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['dry', 'wet', 'hazardous', 'bulk'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setNewReport({...newReport, category: cat})}
                        className={cn(
                          "py-3 px-4 rounded-xl text-sm font-medium transition-all capitalize border",
                          newReport.category === cat 
                            ? "bg-green-600 border-green-600 text-white shadow-md shadow-green-200" 
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-bold text-slate-700">Address / Location</label>
                    <button
                      type="button"
                      onClick={handleDetectLocation}
                      disabled={isLocating}
                      className={cn(
                        "text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer",
                        isLocating 
                          ? "bg-slate-100 text-slate-400" 
                          : locationPermitted === true 
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                      )}
                    >
                      {isLocating ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                          Locating via Google...
                        </>
                      ) : locationPermitted === true ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                          Located Successfully
                        </>
                      ) : (
                        <>
                          <MapPin className="w-3 h-3 text-blue-500" />
                          Detect Location (Google Provider)
                        </>
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                    <input 
                      type="text"
                      required
                      placeholder="e.g., 4th Main, Hebbal"
                      className="w-full bg-slate-50 border-none rounded-xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-green-500 transition-all font-medium text-slate-800"
                      value={newReport.address}
                      onChange={(e) => setNewReport({...newReport, address: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
                  <textarea 
                    required
                    placeholder="Provide details about the issue..."
                    rows={4}
                    className="w-full bg-slate-50 border-none rounded-xl py-3.5 px-4 focus:ring-2 focus:ring-green-500 transition-all resize-none"
                    value={newReport.description}
                    onChange={(e) => setNewReport({...newReport, description: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Evidence Image</label>
                  <div className="space-y-4">
                    {isUploading ? (
                      <div className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                        <Loader2 className="w-8 h-8 text-green-600 animate-spin mb-2" />
                        <div className="w-32 bg-slate-200 rounded-full h-1.5 overflow-hidden mb-1">
                          <motion.div 
                            className="bg-green-600 h-full"
                            style={{ width: `${uploadProgress || 0}%` }}
                          />
                        </div>
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Uploading {Math.round(uploadProgress || 0)}%</p>
                      </div>
                    ) : newReport.imageUrl ? (
                      <div className="relative group rounded-2xl overflow-hidden border-2 border-green-500 shadow-lg">
                        <img 
                          src={newReport.imageUrl} 
                          alt="Preview" 
                          className="w-full h-48 object-cover transition-transform group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                        <button 
                          type="button"
                          onClick={() => setNewReport({ ...newReport, imageUrl: '' })}
                          className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full shadow-lg opacity-100 hover:bg-red-600 transition-all cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-green-600 py-1 text-center">
                          <p className="text-[10px] text-white font-bold uppercase tracking-widest">Image Ready</p>
                        </div>
                      </div>
                    ) : isCameraActive ? (
                      <div className="relative bg-black rounded-3xl overflow-hidden shadow-inner flex flex-col items-center">
                        {cameraError ? (
                          <div className="p-6 text-center text-red-400 text-sm w-full">
                            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
                            <p className="font-medium">{cameraError}</p>
                            <button
                              type="button"
                              onClick={() => setIsCameraActive(false)}
                              className="mt-3 px-4 py-2 bg-slate-800 rounded-xl text-white text-xs font-bold"
                            >
                              Close
                            </button>
                          </div>
                        ) : (
                          <div className="relative w-full">
                            <video
                              ref={videoRef}
                              autoPlay
                              playsInline
                              className="w-full h-56 object-cover bg-black"
                            />
                            {/* Camera Actions Overlay */}
                            <div className="absolute bottom-4 left-0 right-0 flex justify-between items-center px-6 z-10">
                              <button
                                type="button"
                                onClick={stopCamera}
                                className="px-3.5 py-2 bg-slate-900/80 backdrop-blur text-white text-xs font-bold rounded-xl hover:bg-slate-800 cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={captureSnapshot}
                                className="w-14 h-14 bg-red-600 hover:bg-red-700 border-4 border-white rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer"
                                title="Capture Photo"
                              >
                                <div className="w-8 h-8 rounded-full border-2 border-dashed border-white" />
                              </button>
                              <div className="w-16" /> {/* Spacer */}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {/* Live Camera button */}
                        <button
                          type="button"
                          onClick={startCamera}
                          className="flex flex-col items-center justify-center p-5 bg-slate-50 hover:bg-green-50/50 border-2 border-dashed border-slate-200 hover:border-green-400 rounded-2xl transition-all group cursor-pointer"
                        >
                          <div className="p-3 bg-white rounded-xl shadow-sm text-slate-400 group-hover:text-green-500 transition-colors mb-2">
                            <Camera className="w-5 h-5 text-green-600" />
                          </div>
                          <span className="text-xs font-bold text-slate-700">Direct Camera</span>
                          <span className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Access Camera Stream</span>
                        </button>

                        {/* Gallery upload */}
                        <label className="flex flex-col items-center justify-center p-5 bg-slate-50 hover:bg-green-50/50 border-2 border-dashed border-slate-200 hover:border-green-400 rounded-2xl transition-all group cursor-pointer">
                          <div className="p-3 bg-white rounded-xl shadow-sm text-slate-400 group-hover:text-green-500 transition-colors mb-2">
                            <Upload className="w-5 h-5 text-slate-600" />
                          </div>
                          <span className="text-xs font-bold text-slate-700">Upload Photo</span>
                          <span className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Browse Files</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleFileUpload}
                            disabled={isUploading}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={handleCloseReportModal}
                    className="flex-1 py-3.5 px-4 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-3.5 px-4 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-100 flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Submit Report
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Profile Edit Modal */}
      <AnimatePresence>
        {isEditingProfile && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditingProfile(false)}
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
                  <UserCircle className="w-6 h-6 text-slate-900" />
                  Your Profile
                </h3>
                <button 
                  onClick={() => setIsEditingProfile(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Display Name</label>
                  <input 
                    type="text"
                    required
                    placeholder="Enter your name"
                    className="w-full bg-slate-50 border-none rounded-xl py-3.5 px-4 focus:ring-2 focus:ring-green-500 transition-all font-medium"
                    value={editProfileData.name}
                    onChange={(e) => setEditProfileData({...editProfileData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Your Area</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="e.g., Saraswathipuram"
                      className="w-full bg-slate-50 border-none rounded-xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-green-500 transition-all font-medium"
                      value={editProfileData.area}
                      onChange={(e) => setEditProfileData({...editProfileData, area: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Photo URL</label>
                  <div className="relative">
                    <Camera className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                    <input 
                      type="url"
                      placeholder="https://example.com/photo.jpg"
                      className="w-full bg-slate-50 border-none rounded-xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-green-500 transition-all font-medium"
                      value={editProfileData.photoUrl}
                      onChange={(e) => setEditProfileData({...editProfileData, photoUrl: e.target.value})}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">Provide an image link to personalize your profile.</p>
                </div>

                <div className="pt-4">
                  <button 
                    type="submit" 
                    className="w-full py-4 px-6 rounded-2xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors shadow-lg flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Save className="w-5 h-5" />
                    Update Profile
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Feedback Modal */}
      <AnimatePresence>
        {feedbackReportId && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFeedbackReportId(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-3xl shadow-2xl z-[70] p-8 border border-slate-100"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Star className="w-8 h-8 text-orange-500 fill-current" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">How was our service?</h3>
                <p className="text-slate-500 text-sm mt-2">Your feedback helps us improve garbage collection in Mysore.</p>
              </div>

              <form onSubmit={handleSubmitFeedback} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 text-center mb-4">Rating</label>
                  <div className="flex justify-center gap-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackForm({...feedbackForm, rating: star})}
                        className="p-2 transition-transform active:scale-90"
                      >
                        <Star 
                          className={cn(
                            "w-8 h-8 transition-colors",
                            star <= feedbackForm.rating ? "text-orange-400 fill-current" : "text-slate-200"
                          )} 
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Comment (Optional)</label>
                  <textarea 
                    placeholder="Tell us what we did well or how we can improve..."
                    rows={3}
                    className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-green-500 transition-all resize-none"
                    value={feedbackForm.comment}
                    onChange={(e) => setFeedbackForm({...feedbackForm, comment: e.target.value})}
                  />
                </div>

                <div className="flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setFeedbackReportId(null)}
                    className="flex-1 py-3.5 px-4 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Not now
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-3.5 px-4 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors shadow-lg flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Submit
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function Trash2Icon({ className }: { className?: string }) {
  return (
    <svg 
      className={className}
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />
    </svg>
  );
}
