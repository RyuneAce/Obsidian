import React, { useState, useEffect } from 'react';
import { Play, Pause, Trash2, PlayCircle, PauseCircle, Trash } from 'lucide-react';
import InfoGate from '../../components/InfoGate';
import { QueueService } from './QueueService';
import dataLake from '../../datalake/Database';

function QueueView() {
    const [jobs, setJobs] = useState([]);
    const [activeJobId, setActiveJobId] = useState(null);
    const [activeJob, setActiveJob] = useState(null);
    
    const queueService = new QueueService(dataLake);

    const loadJobs = async () => {
        const allJobs = await queueService.getAllJobs();
        setJobs(allJobs);
    };

    useEffect(() => {
        loadJobs();
        const interval = setInterval(loadJobs, 2000); // Polling for updates if background stuff happens
        return () => clearInterval(interval);
    }, []);

    const handlePlayAll = async () => {
        const pendingJobs = jobs.filter(j => j.status !== 'COMPLETED' && j.status !== 'RUNNING');
        if (pendingJobs.length > 0) {
            handlePlayJob(pendingJobs[0].queueJobId);
        }
    };

    const handlePauseAll = async () => {
        if (activeJobId) {
            await handlePauseJob(activeJobId);
        }
    };

    const handleDeleteAll = async () => {
        if (window.confirm("Delete all queued processes?")) {
            if (window.confirm("All pending queue work will be discarded. Are you sure?")) {
                await queueService.clearAll();
                setActiveJobId(null);
                setActiveJob(null);
                loadJobs();
            }
        }
    };

    const handlePlayJob = async (id) => {
        if (activeJobId && activeJobId !== id) {
            alert("Another queued transaction is currently running.");
            return;
        }
        await queueService.setJobStatus(id, 'RUNNING');
        const job = await queueService.getJob(id);
        setActiveJob(job);
        setActiveJobId(id);
        loadJobs();
    };

    const handlePauseJob = async (id) => {
        if (activeJobId === id) {
            await queueService.setJobStatus(id, 'PAUSED');
            setActiveJobId(null);
            setActiveJob(null);
            loadJobs();
        } else {
            await queueService.setJobStatus(id, 'PAUSED');
            loadJobs();
        }
    };

    const handleDeleteJob = async (id) => {
        if (window.confirm("Delete this queued process?\nAny unsaved progress in this queue entry will be discarded.")) {
            if (activeJobId === id) {
                setActiveJobId(null);
                setActiveJob(null);
            }
            await queueService.deleteJob(id);
            loadJobs();
        }
    };

    const onInfoGateComplete = async (result) => {
        if (activeJobId) {
            await queueService.setJobStatus(activeJobId, 'COMPLETED');
            setActiveJobId(null);
            setActiveJob(null);
            loadJobs();
            
            // If Play All was triggered conceptually we could check for more jobs here.
            // For now, playing the next job automatically when Play All is pressed.
            const allJobs = await queueService.getAllJobs();
            const nextJob = allJobs.find(j => j.status !== 'COMPLETED' && j.status !== 'RUNNING');
            if (nextJob) {
               // To avoid deep recursion, we setTimeout to start the next one
               setTimeout(() => handlePlayJob(nextJob.queueJobId), 500);
            }
        }
    };

    const onInfoGateCancel = async () => {
        if (activeJobId) {
            await queueService.setJobStatus(activeJobId, 'PAUSED');
            setActiveJobId(null);
            setActiveJob(null);
            loadJobs();
        }
    };

    return (
        <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <h1 style={{ fontSize: '24px', m: 0 }}>API Queue</h1>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={handlePlayAll} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--accent)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                        <PlayCircle size={18} /> Play All
                    </button>
                    <button onClick={handlePauseAll} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                        <PauseCircle size={18} /> Pause All
                    </button>
                    <button onClick={handleDeleteAll} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,0,0,0.15)', color: 'var(--danger)', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                        <Trash size={18} /> Delete All
                    </button>
                </div>
            </div>

            <div style={{ background: 'var(--bg-dark)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                {jobs.length === 0 ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Queue is empty.
                    </div>
                ) : (
                    jobs.map(job => (
                        <div key={job.queueJobId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border)', background: job.queueJobId === activeJobId ? 'rgba(255,255,255,0.05)' : 'transparent' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                {job.status === 'RUNNING' ? <Play size={16} className="text-accent" /> : <Pause size={16} style={{ color: 'var(--text-muted)' }} />}
                                <span style={{ fontWeight: 'bold', fontSize: '15px' }}>{job.transactionReferenceId}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                    · {job.completedItems}/{job.totalItems} · {job.status.replace(/_/g, ' ')}
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button onClick={() => handlePlayJob(job.queueJobId)} disabled={activeJobId && activeJobId !== job.queueJobId} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: activeJobId && activeJobId !== job.queueJobId ? 'not-allowed' : 'pointer', opacity: activeJobId && activeJobId !== job.queueJobId ? 0.3 : 1 }}>
                                    <Play size={18} />
                                </button>
                                <button onClick={() => handlePauseJob(job.queueJobId)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                                    <Pause size={18} />
                                </button>
                                <button onClick={() => handleDeleteJob(job.queueJobId)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {activeJobId && activeJob && (
                <InfoGate 
                    queueJobId={activeJobId}
                    initialTransaction={activeJob.checkpoint}
                    startFromIndex={activeJob.currentItemIndex}
                    queueService={queueService}
                    dataLake={dataLake}
                    onComplete={onInfoGateComplete}
                    onCancel={onInfoGateCancel}
                />
            )}
        </div>
    );
}

const QueuePlugin = {
    pluginId: 'queue',
    name: 'Queue',
    version: '1.0.0',
    initialize: (dataLake) => {},
    routes: [{ path: '/queue', component: () => <QueueView /> }],
    dashboardWidgets: []
};

export default QueuePlugin;
