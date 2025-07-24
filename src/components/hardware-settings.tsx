
'use client';

import { useState, useEffect, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Mic, Volume2 } from 'lucide-react';
import { Progress } from './ui/progress';
import { Input } from './ui/input';

export default function HardwareSettings() {
    const [isOpen, setIsOpen] = useState(false);
    const [devicesLoading, setDevicesLoading] = useState(true);
    const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
    const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
    const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceInfo[]>([]);
    
    const [selectedMicrophone, setSelectedMicrophone] = useState<string>('');
    const [selectedSpeaker, setSelectedSpeaker] = useState<string>('');
    const [selectedCamera, setSelectedCamera] = useState<string>('');

    const [isTestingMic, setIsTestingMic] = useState(false);
    const [micVolume, setMicVolume] = useState(0);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    const getDevices = async () => {
        if (!navigator.mediaDevices?.enumerateDevices) {
            console.warn("Media Devices API not supported.");
            setDevicesLoading(false);
            return;
        }
        setDevicesLoading(true);
        try {
            // Request permissions separately to avoid errors if one device is missing
            try {
                await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch (err) {
                 console.warn("Could not get audio permissions:", err);
            }
             try {
                await navigator.mediaDevices.getUserMedia({ video: true });
            } catch (err) {
                 console.warn("Could not get video permissions:", err);
            }

            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(device => device.kind === 'audioinput');
            const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
            const videoInputs = devices.filter(device => device.kind === 'videoinput');
            
            setAudioInputDevices(audioInputs);
            setAudioOutputDevices(audioOutputs);
            setVideoInputDevices(videoInputs);

            if (audioInputs.length > 0 && !selectedMicrophone) setSelectedMicrophone(audioInputs[0].deviceId);
            if (audioOutputs.length > 0 && !selectedSpeaker) setSelectedSpeaker(audioOutputs[0].deviceId);
            if (videoInputs.length > 0 && !selectedCamera) setSelectedCamera(videoInputs[0].deviceId);
        } catch(err) {
            console.error("Error enumerating devices", err);
        } finally {
            setDevicesLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            getDevices();
        } else {
            stopMicTest();
        }
    }, [isOpen]);

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
        if (!isTestingMic && !animationFrameRef.current) return;
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
                    <div className="grid gap-2">
                         <div className="flex justify-between items-center">
                            <Label htmlFor="mic-select" className="flex items-center gap-2"><Mic className="h-4 w-4"/>Microphone</Label>
                            <Button variant="link" size="sm" className="p-0 h-auto" onClick={toggleMicTest}>{isTestingMic ? 'Stop' : 'Test'}</Button>
                        </div>
                        <Select value={selectedMicrophone} onValueChange={setSelectedMicrophone} disabled={isTestingMic}>
                            <SelectTrigger id="mic-select">
                                <SelectValue placeholder="Select Microphone" />
                            </SelectTrigger>
                            <SelectContent>
                                {audioInputDevices.map(device => (
                                    <SelectItem key={device.deviceId} value={device.deviceId}>
                                        {device.label || `Microphone ${audioInputDevices.indexOf(device) + 1}`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {isTestingMic && <Progress value={micVolume} className="h-2 mt-1" />}
                    </div>
                     <div className="grid gap-2">
                        <div className="flex justify-between items-center">
                             <Label htmlFor="speaker-select" className="flex items-center gap-2"><Volume2 className="h-4 w-4"/>Speaker / Headset</Label>
                        </div>
                         <Select value={selectedSpeaker} onValueChange={setSelectedSpeaker}>
                            <SelectTrigger id="speaker-select">
                                <SelectValue placeholder="Select Speaker" />
                            </SelectTrigger>
                            <SelectContent>
                               {audioOutputDevices.map(device => (
                                    <SelectItem key={device.deviceId} value={device.deviceId}>
                                        {device.label || `Speaker ${audioOutputDevices.indexOf(device) + 1}`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                         <Label htmlFor="camera-select">Camera</Label>
                         {devicesLoading ? (
                             <Input disabled placeholder="Detecting cameras..." />
                         ) : videoInputDevices.length > 0 ? (
                            <Select value={selectedCamera} onValueChange={setSelectedCamera}>
                                <SelectTrigger id="camera-select">
                                    <SelectValue placeholder="Select Camera" />
                                </SelectTrigger>
                                <SelectContent>
                                    {videoInputDevices.map(device => (
                                        <SelectItem key={device.deviceId} value={device.deviceId}>
                                            {device.label || `Camera ${videoInputDevices.indexOf(device) + 1}`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                         ) : (
                            <Input disabled value="No camera devices found." />
                         )}
                    </div>
                     <div className="grid gap-2 mt-2">
                        <Button variant="link" className="justify-start p-0 h-auto text-primary">Advanced hardware settings</Button>
                        <Button variant="link" className="justify-start p-0 h-auto text-primary">Customize notification & sounds</Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
