import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AppState, ImageFile, AnalysisResult } from './types';
import { analyzeArtwork } from './services/geminiService';
import { 
  CameraIcon, 
  UploadIcon, 
  PhotoIcon, 
  RefreshIcon, 
  XMarkIcon, 
  SparklesIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  SpeakerIcon
} from './components/Icons';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.HOME);
  const [image, setImage] = useState<ImageFile | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Audio State
  const [audioState, setAudioState] = useState<'STOPPED' | 'PLAYING' | 'PAUSED'>('STOPPED');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Initialize/Cleanup Speech Synthesis
  useEffect(() => {
    const loadVoices = () => {
       window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    
    return () => {
      window.speechSynthesis.cancel();
    }
  }, []);

  // Stop audio when state changes away from result
  useEffect(() => {
    if (appState !== AppState.RESULT) {
       window.speechSynthesis.cancel();
       setAudioState('STOPPED');
    }
  }, [appState]);

  const startCamera = async () => {
    setAppState(AppState.CAMERA);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access denied:", err);
      setError("Kamerazugriff verweigert. Bitte laden Sie ein Bild hoch.");
      setAppState(AppState.HOME);
    }
  };

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  }, []);

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const base64Data = dataUrl.split(',')[1];
        
        setImage({ data: base64Data, mimeType: 'image/jpeg' });
        stopCamera();
        setAppState(AppState.PREVIEW);
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64Data = dataUrl.split(',')[1];
        const mimeType = dataUrl.split(':')[1].split(';')[0];
        
        setImage({ data: base64Data, mimeType });
        setAppState(AppState.PREVIEW);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleAnalyze = async () => {
    if (!image) return;
    setAppState(AppState.ANALYZING);
    setError(null);
    
    try {
      const analysis = await analyzeArtwork(image.data, image.mimeType);
      setResult(analysis);
      setAppState(AppState.RESULT);
    } catch (err: any) {
      setError(err.message || "An unknown error occurred.");
      setAppState(AppState.PREVIEW); // Go back to preview on error so they can retry
    }
  };

  const resetApp = () => {
    stopCamera();
    setImage(null);
    setResult(null);
    setError(null);
    setAppState(AppState.HOME);
  };

  // --- Audio Logic ---
  const toggleAudio = () => {
     if (audioState === 'PLAYING') {
        window.speechSynthesis.pause();
        setAudioState('PAUSED');
     } else if (audioState === 'PAUSED') {
        window.speechSynthesis.resume();
        setAudioState('PLAYING');
     } else {
        // Start playing
        if (!result?.text) return;
        
        // Clean markdown/formatting for better speech
        const cleanText = result.text
          .replace(/[#*]/g, '') // remove headings/bold markers
          .replace(/\[.*?\]/g, '') // remove reference links
          .replace(/\(https?:\/\/[^\)]+\)/g, ''); // remove urls

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'de-DE';
        utterance.rate = 0.95; // Slightly slower for better guide experience
        
        const voices = window.speechSynthesis.getVoices();
        // Try to find a high quality German voice
        const germanVoice = voices.find(v => v.lang.includes('de') && v.name.toLowerCase().includes('google')) || 
                            voices.find(v => v.lang.includes('de'));
        if (germanVoice) utterance.voice = germanVoice;

        utterance.onend = () => setAudioState('STOPPED');
        utterance.onerror = () => setAudioState('STOPPED');

        speechRef.current = utterance;
        window.speechSynthesis.speak(utterance);
        setAudioState('PLAYING');
     }
  };

  const stopAudio = () => {
     window.speechSynthesis.cancel();
     setAudioState('STOPPED');
  };
  
  // Clean up camera on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);


  // --- Render Views ---

  const renderHome = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-900 px-6 text-center relative overflow-hidden">
       {/* Background decoration */}
       <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
         <img src="https://picsum.photos/800/1200?grayscale" alt="Background Art" className="object-cover w-full h-full" />
       </div>

      <div className="z-10 max-w-md w-full">
        <div className="mb-8 flex justify-center">
           <div className="p-4 rounded-full bg-amber-500/20 ring-1 ring-amber-500/50">
              <SparklesIcon className="w-12 h-12 text-amber-400" />
           </div>
        </div>
        <h1 className="text-5xl font-bold text-white mb-4 tracking-tight font-serif">KunstKenner</h1>
        <p className="text-lg text-gray-400 mb-10 font-light leading-relaxed">
          Entdecken Sie die Geschichten hinter den Meisterwerken. <br/>
          Scannen Sie ein Gemälde für eine sofortige Analyse.
        </p>

        <div className="space-y-4">
          <button 
            onClick={startCamera}
            className="w-full py-4 px-6 bg-white text-zinc-900 rounded-xl font-semibold flex items-center justify-center gap-3 hover:bg-gray-100 transition-all shadow-lg shadow-white/10 active:scale-95"
          >
            <CameraIcon className="w-6 h-6" />
            <span>Foto aufnehmen</span>
          </button>

          <button 
            onClick={triggerFileUpload}
            className="w-full py-4 px-6 bg-zinc-800 text-white border border-zinc-700 rounded-xl font-semibold flex items-center justify-center gap-3 hover:bg-zinc-700 transition-all active:scale-95"
          >
            <UploadIcon className="w-6 h-6" />
            <span>Bild hochladen</span>
          </button>
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileUpload}
          />
        </div>
        
        {error && (
           <div className="mt-6 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
             {error}
           </div>
        )}
      </div>
      
      <footer className="absolute bottom-6 text-xs text-gray-600">
         Powered by Gemini 2.5 & Google Search
      </footer>
    </div>
  );

  const renderCamera = () => (
    <div className="relative h-screen bg-black overflow-hidden flex flex-col">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        className="flex-1 object-cover w-full h-full"
      />
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Camera Overlay */}
      <div className="absolute inset-0 pointer-events-none border-[30px] border-black/50 flex items-center justify-center">
         <div className="w-64 h-64 border border-white/50 rounded-lg relative">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-amber-400 -mt-1 -ml-1"></div>
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-amber-400 -mt-1 -mr-1"></div>
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-amber-400 -mb-1 -ml-1"></div>
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-amber-400 -mb-1 -mr-1"></div>
         </div>
      </div>

      <div className="absolute bottom-0 w-full p-8 flex justify-between items-center bg-gradient-to-t from-black/90 to-transparent">
        <button 
          onClick={() => { stopCamera(); setAppState(AppState.HOME); }}
          className="p-4 rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur-md"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
        
        <button 
          onClick={captureImage}
          className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center relative group"
        >
           <div className="w-16 h-16 bg-white rounded-full group-active:scale-90 transition-transform" />
        </button>
        
        <button onClick={triggerFileUpload} className="p-4 rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur-md">
           <PhotoIcon className="w-6 h-6" />
        </button>
      </div>
    </div>
  );

  const renderPreview = () => (
    <div className="min-h-screen bg-zinc-900 flex flex-col p-6">
       <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <h2 className="text-2xl font-serif text-white">Vorschau</h2>
          {image && (
            <div className="relative w-full max-w-md rounded-lg overflow-hidden shadow-2xl ring-1 ring-white/10">
              <img 
                src={`data:${image.mimeType};base64,${image.data}`} 
                alt="Captured Art" 
                className="w-full h-auto max-h-[60vh] object-contain bg-black" 
              />
            </div>
          )}
          
          {error && (
           <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm max-w-md w-full text-center">
             {error}
           </div>
          )}
       </div>
       
       <div className="w-full max-w-md mx-auto grid grid-cols-2 gap-4 mt-auto pt-6">
          <button 
            onClick={resetApp}
            className="py-3 px-4 rounded-xl bg-zinc-800 text-white font-medium hover:bg-zinc-700 transition-colors border border-zinc-700"
          >
            Abbrechen
          </button>
          <button 
            onClick={handleAnalyze}
            className="py-3 px-4 rounded-xl bg-amber-500 text-black font-bold hover:bg-amber-400 transition-colors flex items-center justify-center gap-2"
          >
             <SparklesIcon className="w-5 h-5" />
             Analysieren
          </button>
       </div>
    </div>
  );

  const renderAnalyzing = () => (
    <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center text-center px-6 relative overflow-hidden">
       {/* Animated background blob */}
       <div className="absolute w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse"></div>
       
       <div className="z-10 relative">
         <div className="w-16 h-16 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mb-6 mx-auto"></div>
         <h2 className="text-2xl font-serif text-white mb-2">Kunstwerk wird analysiert...</h2>
         <p className="text-gray-400 text-sm animate-pulse">Das Genie denkt nach und durchsucht das Internet...</p>
       </div>
    </div>
  );

  const renderResult = () => {
    if (!result) return null;

    return (
      <div className="min-h-screen bg-[#FDFBF7] text-zinc-900 flex flex-col font-sans">
         {/* Header with Image */}
         <div className="relative h-64 md:h-80 bg-zinc-900 shrink-0">
            {image && (
              <img 
                src={`data:${image.mimeType};base64,${image.data}`} 
                alt="Artwork" 
                className="w-full h-full object-contain opacity-90"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#FDFBF7] to-transparent h-24 top-auto bottom-0"></div>
            
            <button 
              onClick={resetApp}
              className="absolute top-4 left-4 p-2 bg-black/30 backdrop-blur-md rounded-full text-white hover:bg-black/50"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
         </div>

         {/* Content */}
         <div className="px-6 md:px-8 -mt-10 relative z-10 max-w-3xl mx-auto w-full flex-1 flex flex-col">
            
            {/* Audio Guide Player */}
            <div className="bg-white rounded-xl p-4 mb-6 flex items-center justify-between shadow-lg shadow-black/5 border border-zinc-100">
               <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-full transition-colors ${audioState === 'PLAYING' ? 'bg-amber-500 text-black animate-pulse' : 'bg-amber-100 text-amber-600'}`}>
                     <SpeakerIcon className="w-6 h-6" />
                  </div>
                  <div>
                     <p className="font-serif font-bold text-zinc-900">Audioguide</p>
                     <p className="text-xs text-zinc-500">
                       {audioState === 'PLAYING' ? 'Wiedergabe läuft...' : audioState === 'PAUSED' ? 'Pausiert' : 'Jetzt anhören'}
                     </p>
                  </div>
               </div>
               <div className="flex items-center gap-2">
                  {audioState === 'STOPPED' ? (
                     <button onClick={toggleAudio} className="w-12 h-12 rounded-full bg-zinc-900 text-white flex items-center justify-center hover:bg-zinc-800 transition-colors shadow-md">
                        <PlayIcon className="w-6 h-6 ml-1" /> 
                     </button>
                  ) : (
                     <>
                       <button onClick={toggleAudio} className="w-10 h-10 rounded-full bg-zinc-100 text-zinc-900 flex items-center justify-center hover:bg-zinc-200 transition-colors border border-zinc-200">
                          {audioState === 'PLAYING' ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5 ml-0.5" />}
                       </button>
                       <button onClick={stopAudio} className="w-10 h-10 rounded-full bg-zinc-100 text-red-500 flex items-center justify-center hover:bg-red-50 transition-colors border border-zinc-200">
                          <StopIcon className="w-5 h-5" />
                       </button>
                     </>
                  )}
               </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8 ring-1 ring-black/5 mb-8">
               {/* Essay Body */}
               <div className="prose prose-zinc prose-lg max-w-none">
                 {/* Simple Markdown-like rendering */}
                 {result.text.split('\n').map((line, idx) => {
                   if (line.startsWith('## ')) {
                     return <h2 key={idx} className="text-2xl font-serif font-bold text-zinc-900 mt-6 mb-3 border-b border-amber-200 pb-1">{line.replace('## ', '')}</h2>;
                   }
                   if (line.startsWith('### ')) {
                     return <h3 key={idx} className="text-xl font-serif font-semibold text-zinc-800 mt-4 mb-2">{line.replace('### ', '')}</h3>;
                   }
                   if (line.startsWith('**') && line.endsWith('**')) {
                      return <strong key={idx} className="block font-bold text-zinc-900 my-2">{line.replace(/\*\*/g, '')}</strong>;
                   }
                   if (line.startsWith('* ') || line.startsWith('- ')) {
                      return <li key={idx} className="ml-4 list-disc text-zinc-700 my-1">{line.replace(/^[\*\-] /, '')}</li>;
                   }
                   if (line.trim() === '') return <br key={idx} />;
                   
                   // Handle bold inline
                   const parts = line.split(/(\*\*.*?\*\*)/g);
                   return (
                     <p key={idx} className="text-zinc-700 leading-relaxed mb-3 text-justify">
                       {parts.map((part, i) => 
                         part.startsWith('**') && part.endsWith('**') 
                           ? <span key={i} className="font-bold text-zinc-900">{part.slice(2, -2)}</span> 
                           : part
                       )}
                     </p>
                   );
                 })}
               </div>
            </div>

            {/* Grounding / Sources Section */}
            {result.groundingChunks && result.groundingChunks.length > 0 && (
              <div className="mb-8 p-6 bg-zinc-100 rounded-xl border border-zinc-200">
                <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Quellen & Verifizierung
                </h3>
                <div className="grid gap-2">
                  {result.groundingChunks.map((chunk, idx) => {
                    if (chunk.web) {
                      return (
                        <a 
                          key={idx} 
                          href={chunk.web.uri} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 bg-white rounded-lg border border-zinc-200 hover:border-amber-400 hover:shadow-md transition-all group"
                        >
                          <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center shrink-0">
                             <span className="text-blue-600 text-xs font-bold">G</span>
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-sm font-medium text-zinc-900 truncate group-hover:text-amber-600 transition-colors">{chunk.web.title}</p>
                            <p className="text-xs text-zinc-500 truncate">{chunk.web.uri}</p>
                          </div>
                        </a>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            )}

            <div className="pb-10">
               <button 
                 onClick={resetApp}
                 className="w-full py-4 rounded-xl bg-zinc-900 text-white font-bold hover:bg-zinc-800 transition-colors shadow-lg flex items-center justify-center gap-2"
               >
                 <RefreshIcon className="w-5 h-5" />
                 Nächstes Kunstwerk scannen
               </button>
            </div>
         </div>
      </div>
    );
  };

  switch (appState) {
    case AppState.HOME: return renderHome();
    case AppState.CAMERA: return renderCamera();
    case AppState.PREVIEW: return renderPreview();
    case AppState.ANALYZING: return renderAnalyzing();
    case AppState.RESULT: return renderResult();
    default: return renderHome();
  }
};

export default App;