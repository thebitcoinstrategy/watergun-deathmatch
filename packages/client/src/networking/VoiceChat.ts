const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export class VoiceChat {
  private localStream: MediaStream | null = null;
  private peers: Map<string, RTCPeerConnection> = new Map();
  private remoteAudios: Map<string, HTMLAudioElement> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private sendSignal: (type: string, data: any) => void;
  private myId: string;
  private enabled = false;

  constructor(myId: string, sendSignal: (type: string, data: any) => void) {
    this.myId = myId;
    this.sendSignal = sendSignal;
  }

  async enable(): Promise<void> {
    if (this.enabled) return;
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      this.enabled = true;
    } catch (err) {
      console.error('Voice chat: microphone access denied', err);
      throw err;
    }
  }

  disable(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    this.peers.forEach((pc, id) => {
      pc.close();
      this.removeAudio(id);
    });
    this.peers.clear();
    this.pendingCandidates.clear();
    this.enabled = false;
  }

  async toggle(): Promise<boolean> {
    if (this.enabled) {
      this.disable();
      return false;
    } else {
      await this.enable();
      return true;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  addPeer(peerId: string): void {
    if (!this.enabled || !this.localStream || peerId === this.myId) return;
    if (this.peers.has(peerId)) return;

    // Lower sessionId initiates the offer
    if (this.myId < peerId) {
      this.createPeerConnection(peerId, true);
    }
    // Otherwise wait for their offer
  }

  removePeer(peerId: string): void {
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
    }
    this.removeAudio(peerId);
    this.pendingCandidates.delete(peerId);
  }

  async handleSignal(fromId: string, signal: { type: string; sdp?: string; candidate?: RTCIceCandidateInit }): Promise<void> {
    if (!this.enabled || !this.localStream) return;

    if (signal.type === 'offer') {
      // Incoming offer — create connection and answer
      const pc = this.createPeerConnection(fromId, false);
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp! }));
      // Flush pending ICE candidates
      this.flushCandidates(fromId, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.sendSignal('voiceAnswer', { targetId: fromId, sdp: answer.sdp });
    } else if (signal.type === 'answer') {
      const pc = this.peers.get(fromId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp! }));
        this.flushCandidates(fromId, pc);
      }
    } else if (signal.type === 'ice') {
      const pc = this.peers.get(fromId);
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate!));
      } else {
        // Queue candidate until remote description is set
        if (!this.pendingCandidates.has(fromId)) this.pendingCandidates.set(fromId, []);
        this.pendingCandidates.get(fromId)!.push(signal.candidate!);
      }
    }
  }

  private createPeerConnection(peerId: string, initiator: boolean): RTCPeerConnection {
    // Close existing if any
    if (this.peers.has(peerId)) {
      this.peers.get(peerId)!.close();
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.peers.set(peerId, pc);

    // Add local audio tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // ICE candidate handling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal('voiceIce', { targetId: peerId, candidate: event.candidate.toJSON() });
      }
    };

    // Remote audio track
    pc.ontrack = (event) => {
      let audio = this.remoteAudios.get(peerId);
      if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        (audio as any).playsInline = true;
        this.remoteAudios.set(peerId, audio);
      }
      audio.srcObject = event.streams[0] || new MediaStream([event.track]);
    };

    // If initiator, create and send offer
    if (initiator) {
      pc.createOffer().then(offer => {
        return pc.setLocalDescription(offer);
      }).then(() => {
        this.sendSignal('voiceOffer', { targetId: peerId, sdp: pc.localDescription!.sdp });
      });
    }

    return pc;
  }

  private flushCandidates(peerId: string, pc: RTCPeerConnection): void {
    const queued = this.pendingCandidates.get(peerId);
    if (queued) {
      for (const c of queued) {
        pc.addIceCandidate(new RTCIceCandidate(c));
      }
      this.pendingCandidates.delete(peerId);
    }
  }

  private removeAudio(peerId: string): void {
    const audio = this.remoteAudios.get(peerId);
    if (audio) {
      audio.srcObject = null;
      this.remoteAudios.delete(peerId);
    }
  }

  destroy(): void {
    this.disable();
  }
}
