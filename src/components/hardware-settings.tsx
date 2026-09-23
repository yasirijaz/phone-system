
'use client';

import { useState, useEffect, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Mic, Volume2, PhoneCall } from 'lucide-react';
import { Progress } from './ui/progress';
import { Input } from './ui/input';

export default function HardwareSettings() {
    const [isOpen, setIsOpen] = useState(false);
    const [devicesLoading, setDevicesLoading] = useState(true);
    const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
    const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
    const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceInfo[]>([]);
    
    const [selectedMicrophone, setSelectedMicrophone] = useState('');
    const [selectedSpeaker, setSelectedSpeaker] = useState('');
    const [selectedCamera, setSelectedCamera] = useState('');

    // Mic testing states
    const [isTestingMic, setIsTestingMic] = useState(false);
    const [micVolume, setMicVolume] = useState(0);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Loopback test states
    const [isMakingTestCall, setIsMakingTestCall] = useState(false);
    const [testCallStatus, setTestCallStatus] = useState<string>('');
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const STORAGE_KEYS = {
        microphone: 'hardware_selected_microphone',
        speaker: 'hardware_selected_speaker',
        camera: 'hardware_selected_camera',
    };

    const stopStream = (stream?: MediaStream | null) => {
        stream?.getTracks().forEach((track) => track.stop());
    };

    const getDevices = async (requestLabels = false) => {
        if (!navigator.mediaDevices?.enumerateDevices) {
            console.warn('Media Devices API not supported.');
            setDevicesLoading(false);
            return;
        }

        setDevicesLoading(true);

        try {
            let devices = await navigator.mediaDevices.enumerateDevices();
            const needsAudioLabels = requestLabels && devices.some((d) => d.kind === 'audioinput' && !d.label);
            const needsVideoLabels = requestLabels && devices.some((d) => d.kind === 'videoinput' && !d.label);

            // Labels require a one-shot permission prompt. Stop tracks immediately so
            // the tab does not keep the mic or camera after the picker opens.
            if (needsAudioLabels) {
                try {
                    stopStream(await navigator.mediaDevices.getUserMedia({ audio: true }));
                } catch (err) {
                    console.warn('Could not get audio permissions:', err);
                }
            }
            if (needsVideoLabels) {
                try {
                    stopStream(await navigator.mediaDevices.getUserMedia({ video: true }));
                } catch (err) {
                    console.warn('Could not get video permissions:', err);
                }
            }
            if (needsAudioLabels || needsVideoLabels) {
                devices = await navigator.mediaDevices.enumerateDevices();
            }

            const audioInputs = devices.filter(
            (device) => device.kind === 'audioinput'
            );

            const audioOutputs = devices.filter(
            (device) => device.kind === 'audiooutput'
            );

            const videoInputs = devices.filter(
            (device) => device.kind === 'videoinput'
            );

            setAudioInputDevices(audioInputs);
            setAudioOutputDevices(audioOutputs);
            setVideoInputDevices(videoInputs);

            const savedMic = localStorage.getItem(
            STORAGE_KEYS.microphone
            );

            const savedSpeaker = localStorage.getItem(
            STORAGE_KEYS.speaker
            );

            const savedCamera = localStorage.getItem(
            STORAGE_KEYS.camera
            );

            const micExists = audioInputs.some(
            (d) => d.deviceId === savedMic
            );

            const speakerExists = audioOutputs.some(
            (d) => d.deviceId === savedSpeaker
            );

            const cameraExists = videoInputs.some(
            (d) => d.deviceId === savedCamera
            );

            if (savedMic && micExists) {
            setSelectedMicrophone(savedMic);
            } else if (
            audioInputs.length > 0 &&
            !selectedMicrophone
            ) {
            setSelectedMicrophone(
                audioInputs[0].deviceId
            );
            }

            if (savedSpeaker && speakerExists) {
            setSelectedSpeaker(savedSpeaker);
            } else if (
            audioOutputs.length > 0 &&
            !selectedSpeaker
            ) {
            setSelectedSpeaker(
                audioOutputs[0].deviceId
            );
            }

            if (savedCamera && cameraExists) {
            setSelectedCamera(savedCamera);
            } else if (
            videoInputs.length > 0 &&
            !selectedCamera
            ) {
            setSelectedCamera(
                videoInputs[0].deviceId
            );
            }
        } catch (err) {
            console.error(
            'Error enumerating devices',
            err
            );
        } finally {
            setDevicesLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            void getDevices(true);
        } else {
            stopMicTest();
        }
    }, [isOpen]);

    useEffect(() => {
        const handleDeviceChange = () => {
            if (!isOpen) return;
            void getDevices(true);
        };

        navigator.mediaDevices?.addEventListener(
            'devicechange',
            handleDeviceChange
        );

        return () => {
            navigator.mediaDevices?.removeEventListener(
            'devicechange',
            handleDeviceChange
            );
        };
    }, [isOpen]);

    useEffect(() => {
        return () => {
            stopMicTest();
        };
    }, []);

    useEffect(() => {
        const savedMic = localStorage.getItem(
            STORAGE_KEYS.microphone
        );

        const savedSpeaker = localStorage.getItem(
            STORAGE_KEYS.speaker
        );

        const savedCamera = localStorage.getItem(
            STORAGE_KEYS.camera
        );

        if (savedMic) {
            setSelectedMicrophone(savedMic);
        }

        if (savedSpeaker) {
            setSelectedSpeaker(savedSpeaker);
        }

        if (savedCamera) {
            setSelectedCamera(savedCamera);
        }
    }, []);

    // 🔹 Microphone Volume Test
    const startMicTest = async () => {
        if (isTestingMic) return;
        setIsTestingMic(true);
        try {
            audioContextRef.current = new AudioContext();
            analyserRef.current = audioContextRef.current.createAnalyser();
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: selectedMicrophone ? { exact: selectedMicrophone } : undefined } });
            streamRef.current = stream;
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);
            
            analyserRef.current.fftSize = 256;
            const bufferLength = analyserRef.current.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const draw = () => {
                if (!analyserRef.current) return;
                analyserRef.current.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((acc, val) => acc + val, 0) / bufferLength;
                setMicVolume(average);
                animationFrameRef.current = requestAnimationFrame(draw);
            };
            draw();

        } catch (err) {
            console.error("Error starting mic test:", err);
            setIsTestingMic(false);
        }
    };

    const stopMicTest = () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        audioContextRef.current?.close();
        audioContextRef.current = null;
        setMicVolume(0);
        setIsTestingMic(false);
    };

    const toggleMicTest = () => {
        isTestingMic ? stopMicTest() : startMicTest();
    };

    // 🔹 Speaker Test
    const testSpeaker = async () => {
        const testAudio = new Audio('/sounds/ringtone.mp3');
        try {
            if (selectedSpeaker && (testAudio as any).setSinkId) {
                await (testAudio as any).setSinkId(selectedSpeaker);
            }
            testAudio.play();
        } catch (err) {
            console.error("Error testing speaker:", err);
        }
    };
    
    // 🔹 Skype-like Loopback Test
    const makeTestCall = async () => {
        try {
            setIsMakingTestCall(true);
            setTestCallStatus("Recording your voice...");

            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { deviceId: selectedMicrophone ? { exact: selectedMicrophone } : undefined } 
            });

            recorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];

            recorderRef.current.ondataavailable = (e) => chunksRef.current.push(e.data);

            recorderRef.current.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                chunksRef.current = [];

                const audioURL = URL.createObjectURL(blob);
                if (audioRef.current) {
                    audioRef.current.src = audioURL;

                    if (selectedSpeaker && (audioRef.current as any).setSinkId) {
                        await (audioRef.current as any).setSinkId(selectedSpeaker);
                    }

                    setTestCallStatus("Playing back your recording...");
                    await audioRef.current.play();
                }

                stream.getTracks().forEach(track => track.stop());
                setTimeout(() => {
                    setIsMakingTestCall(false);
                    setTestCallStatus("");
                }, 5000);
            };

            recorderRef.current.start();
            setTimeout(() => recorderRef.current?.stop(), 3000); // record 3s

        } catch (err) {
            console.error("Error during test call:", err);
            setIsMakingTestCall(false);
            setTestCallStatus("Failed to make a test call.");
        }
    };

    const handleMicrophoneChange = (
        value: string
        ) => {
        setSelectedMicrophone(value);

        localStorage.setItem(
            STORAGE_KEYS.microphone,
            value
        );
    };

    const handleSpeakerChange = (
        value: string
        ) => {
        setSelectedSpeaker(value);

        localStorage.setItem(
            STORAGE_KEYS.speaker,
            value
        );
    };

    const handleCameraChange = (
            value: string
            ) => {
            setSelectedCamera(value);

            localStorage.setItem(
                STORAGE_KEYS.camera,
                value
            );
    };
    
    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Settings className="h-5 w-5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" side="top" align="start">
                <div className="grid gap-4">
                    <div className="space-y-1">
                        <h4 className="font-medium leading-none">Hardware Settings</h4>
                    </div>

                    {/* Microphone */}
                    <div className="grid gap-2">
                        <div className="flex justify-between items-center">
                            <Label htmlFor="mic-select" className="flex items-center gap-2">
                                <Mic className="h-4 w-4"/>Microphone
                            </Label>
                            <Button variant="link" size="sm" className="p-0 h-auto" onClick={toggleMicTest}>
                                {isTestingMic ? 'Stop' : 'Test'}
                            </Button>
                        </div>
                        <Select value={selectedMicrophone} onValueChange={handleMicrophoneChange} disabled={isTestingMic}>
                            <SelectTrigger id="mic-select">
                                <SelectValue placeholder="Select Microphone" />
                            </SelectTrigger>
                            <SelectContent>
                                {audioInputDevices.map((device, idx) => (
                                    <SelectItem 
                                        key={device.deviceId || `mic-${idx}`} 
                                        value={device.deviceId || `mic-${idx}`}
                                    >
                                        {device.label || `Microphone ${idx + 1}`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {isTestingMic && <Progress value={micVolume} className="h-2 mt-1" />}
                    </div>

                    {/* Speaker */}
                    <div className="grid gap-2">
                        <div className="flex justify-between items-center">
                            <Label htmlFor="speaker-select" className="flex items-center gap-2">
                                <Volume2 className="h-4 w-4"/>Speaker / Headset
                            </Label>
                             <Button variant="link" size="sm" className="p-0 h-auto" onClick={testSpeaker}>
                                Test
                            </Button>
                        </div>
                        <Select value={selectedSpeaker} onValueChange={handleSpeakerChange}>
                            <SelectTrigger id="speaker-select">
                                <SelectValue placeholder="Select Speaker" />
                            </SelectTrigger>
                            <SelectContent>
                                {audioOutputDevices.map((device, idx) => (
                                    <SelectItem 
                                        key={device.deviceId || `mic-${idx}`} 
                                        value={device.deviceId || `mic-${idx}`}
                                    >
                                        {device.label || `Speaker ${idx + 1}`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Camera */}
                    <div className="grid gap-2">
                        <Label htmlFor="camera-select">Camera</Label>
                        {devicesLoading ? (
                            <Input disabled placeholder="Detecting cameras..." />
                        ) : videoInputDevices.length > 0 ? (
                            <Select value={selectedCamera} onValueChange={handleCameraChange}>
                                <SelectTrigger id="camera-select">
                                    <SelectValue placeholder="Select Camera" />
                                </SelectTrigger>
                                <SelectContent>
                                    {videoInputDevices.map((device, idx) => (
                                        <SelectItem 
                                            key={device.deviceId || `mic-${idx}`} 
                                            value={device.deviceId || `mic-${idx}`}
                                        >
                                            {device.label || `Camera ${idx + 1}`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input disabled value="No camera devices found." />
                        )}
                    </div>

                    {/* Skype-style Test Call */}
                    <div className="grid gap-2 mt-2">
                        <Button 
                            variant="outline" 
                            className="flex items-center gap-2" 
                            disabled={isMakingTestCall} 
                            onClick={makeTestCall}
                        >
                            <PhoneCall className="h-4 w-4" /> {isMakingTestCall ? "Testing..." : "Make a test call"}
                        </Button>
                        {testCallStatus && <p className="text-sm text-muted-foreground">{testCallStatus}</p>}
                        <audio ref={audioRef} />
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}