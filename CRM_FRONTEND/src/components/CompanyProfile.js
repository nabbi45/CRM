import React, { useState, useEffect } from 'react';
import { apiUrl } from './LoginSignup';
import { enqueueSnackbar } from 'notistack';
import { IconButton, Button } from '@mui/material';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import { useColorMode } from '../context/AppThemeProvider';

const CompanyProfile = () => {
    const { mode } = useColorMode();
    const [profile, setProfile] = useState({
        company_name: '',
        address: '',
        contact_number: '',
        email: '',
        bank_name: '',
        account_name: '',
        account_number: '',
        ifsc_code: '',
        gst_number: '',
        pan_number: '',
        logo_url: '',
        seal_url: '',
        mail_host: '',
        mail_port: '',
        mail_user: '',
        mail_password: '',
        default_cc: ''
    });
    const [loading, setLoading] = useState(false);
    const [file, setFile] = useState(null);
    const [sealFile, setSealFile] = useState(null);

    const userSession = JSON.parse(localStorage.getItem('userSession'));

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await fetch(`${apiUrl}/company`, {
                headers: {
                    'Authorization': userSession?.token,
                    'user-role': userSession?.user_role,
                }
            });
            const data = await res.json();
            if (res.ok && data) {
                setProfile(data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleChange = (e) => {
        setProfile({ ...profile, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleSealFileChange = (e) => {
        setSealFile(e.target.files[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${apiUrl}/company/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': userSession?.token,
                    'user-role': userSession?.user_role,
                },
                body: JSON.stringify(profile)
            });
            const data = await res.json();
            if (res.ok) {
                enqueueSnackbar('Company profile updated!', { variant: 'success' });
                setProfile(data.profile);
            } else {
                enqueueSnackbar(data.message || 'Failed to update', { variant: 'error' });
            }
        } catch (err) {
            enqueueSnackbar('Error updating profile', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleUploadLogo = async () => {
        if (!file) {
            enqueueSnackbar('Please select an image first', { variant: 'warning' });
            return;
        }
        setLoading(true);
        const formData = new FormData();
        formData.append('logo', file);

        try {
            const res = await fetch(`${apiUrl}/company/upload-logo`, {
                method: 'POST',
                headers: {
                    'Authorization': userSession?.token,
                    'user-role': userSession?.user_role,
                },
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                enqueueSnackbar('Logo updated!', { variant: 'success' });
                setProfile((prev) => ({ ...prev, logo_url: data.logo_url }));
                setFile(null);
            } else {
                enqueueSnackbar(data.message, { variant: 'error' });
            }
        } catch (err) {
            enqueueSnackbar('Upload failed', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleUploadSeal = async () => {
        if (!sealFile) {
            enqueueSnackbar('Please select an image first', { variant: 'warning' });
            return;
        }
        setLoading(true);
        const formData = new FormData();
        formData.append('seal', sealFile);

        try {
            const res = await fetch(`${apiUrl}/company/upload-seal`, {
                method: 'POST',
                headers: {
                    'Authorization': userSession?.token,
                    'user-role': userSession?.user_role,
                },
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                enqueueSnackbar('Seal updated!', { variant: 'success' });
                setProfile((prev) => ({ ...prev, seal_url: data.seal_url }));
                setSealFile(null);
            } else {
                enqueueSnackbar(data.message, { variant: 'error' });
            }
        } catch (err) {
            enqueueSnackbar('Upload failed', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = {
        padding: '10px',
        border: `1px solid ${mode === 'light' ? '#ccc' : '#475569'}`,
        borderRadius: '4px',
        width: '100%',
        backgroundColor: mode === 'light' ? '#fff' : '#1e293b',
        color: mode === 'light' ? '#000' : '#fff',
        marginBottom: '15px'
    };

    const labelStyle = { display: 'block', marginBottom: '5px', fontWeight: 'bold' };

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', color: mode === 'light' ? '#0f172a' : '#f8fafc' }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '20px', color: '#111827' }}>Company Profile & Branding</h2>

            <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', alignItems: 'center', backgroundColor: mode === 'light' ? '#f8fafc' : '#0f172a', padding: '20px', borderRadius: '8px', border: `1px solid ${mode === 'light' ? '#e2e8f0' : '#1e293b'}` }}>
                <div style={{ flex: 1 }}>
                    <h3 style={{ marginBottom: '10px' }}>Upload Logo</h3>
                    <p style={{ fontSize: '0.85rem', marginBottom: '15px', color: mode === 'light' ? '#64748b' : '#94a3b8' }}>
                        Suggestion: The best size for your CRM logo is a horizontal image of roughly <strong>300x100 pixels</strong> (PNG or JPG).
                    </p>
                    <input type="file" accept="image/*" onChange={handleFileChange} style={{ marginBottom: '10px' }} />
                    <div>
                        <Button variant="contained" style={{ backgroundColor: '#111827', color: '#fff' }} onClick={handleUploadLogo} disabled={loading || !file}>
                            Upload Logo
                        </Button>
                    </div>
                </div>
                {profile.logo_url && (
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        <img src={profile.logo_url} alt="Company Logo" style={{ maxHeight: '100px', maxWidth: '100%', objectFit: 'contain' }} />
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', alignItems: 'center', backgroundColor: mode === 'light' ? '#f8fafc' : '#0f172a', padding: '20px', borderRadius: '8px', border: `1px solid ${mode === 'light' ? '#e2e8f0' : '#1e293b'}` }}>
                <div style={{ flex: 1 }}>
                    <h3 style={{ marginBottom: '10px' }}>Upload Company Seal</h3>
                    <p style={{ fontSize: '0.85rem', marginBottom: '15px', color: mode === 'light' ? '#64748b' : '#94a3b8' }}>
                        Suggestion: Upload a circular or square format seal for official documents like your Invoices and Agreements.
                    </p>
                    <input type="file" accept="image/*" onChange={handleSealFileChange} style={{ marginBottom: '10px' }} />
                    <div>
                        <Button variant="contained" style={{ backgroundColor: '#111827', color: '#fff' }} onClick={handleUploadSeal} disabled={loading || !sealFile}>
                            Upload Seal
                        </Button>
                    </div>
                </div>
                {profile.seal_url && (
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        <img src={profile.seal_url} alt="Company Seal" style={{ maxHeight: '100px', maxWidth: '100%', objectFit: 'contain' }} />
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit} style={{ backgroundColor: mode === 'light' ? '#f8fafc' : '#0f172a', padding: '20px', borderRadius: '8px', border: `1px solid ${mode === 'light' ? '#e2e8f0' : '#1e293b'}` }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div>
                        <label style={labelStyle}>Company Name</label>
                        <input type="text" name="company_name" value={profile.company_name} onChange={handleChange} style={inputStyle} required />
                    </div>
                    <div>
                        <label style={labelStyle}>Contact Number</label>
                        <input type="text" name="contact_number" value={profile.contact_number} onChange={handleChange} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Email</label>
                        <input type="email" name="email" value={profile.email} onChange={handleChange} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>GST Number</label>
                        <input type="text" name="gst_number" value={profile.gst_number} onChange={handleChange} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>PAN Number</label>
                        <input type="text" name="pan_number" value={profile.pan_number} onChange={handleChange} style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                        <label style={labelStyle}>Address</label>
                        <textarea name="address" value={profile.address} onChange={handleChange} style={{ ...inputStyle, height: '80px', resize: 'vertical' }} required />
                    </div>
                </div>

                <h3 style={{ marginTop: '20px', marginBottom: '15px', color: '#111827', borderBottom: `1px solid ${mode === 'light' ? '#e2e8f0' : '#1e293b'}`, paddingBottom: '10px' }}>Bank Details</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div>
                        <label style={labelStyle}>Bank Name</label>
                        <input type="text" name="bank_name" value={profile.bank_name} onChange={handleChange} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Account Name</label>
                        <input type="text" name="account_name" value={profile.account_name} onChange={handleChange} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Account Number</label>
                        <input type="text" name="account_number" value={profile.account_number} onChange={handleChange} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>IFSC Code</label>
                        <input type="text" name="ifsc_code" value={profile.ifsc_code} onChange={handleChange} style={inputStyle} />
                    </div>
                </div>

                <h3 style={{ marginTop: '20px', marginBottom: '15px', color: '#111827', borderBottom: `1px solid ${mode === 'light' ? '#e2e8f0' : '#1e293b'}`, paddingBottom: '10px' }}>Email Dispatch Configuration</h3>
                <p style={{ fontSize: '0.85rem', marginBottom: '15px', color: mode === 'light' ? '#64748b' : '#94a3b8' }}>
                    Configure SMTP settings to send Agreements and Invoices directly from the CRM. Use an App Password if using Gmail.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div>
                        <label style={labelStyle}>SMTP Host (e.g., smtp.gmail.com)</label>
                        <input type="text" name="mail_host" value={profile.mail_host || ''} onChange={handleChange} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>SMTP Port (e.g., 465)</label>
                        <input type="text" name="mail_port" value={profile.mail_port || ''} onChange={handleChange} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Email Address (Sender)</label>
                        <input type="email" name="mail_user" value={profile.mail_user || ''} onChange={handleChange} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>App Password / SMTP Password</label>
                        <input type="password" name="mail_password" value={profile.mail_password || ''} onChange={handleChange} style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                        <label style={labelStyle}>Default CC (Internal Copies - Comma Separated)</label>
                        <input type="text" name="default_cc" value={profile.default_cc || ''} placeholder="e.g. sales@company.com, manager@company.com" onChange={handleChange} style={inputStyle} />
                    </div>
                </div>

                <Button type="submit" variant="contained" style={{ backgroundColor: '#111827', color: '#fff', marginTop: '20px', width: '100%' }} disabled={loading}>
                    Save Profile Details
                </Button>
            </form>
        </div>
    );
};

export default CompanyProfile;
