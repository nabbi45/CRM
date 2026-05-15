import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import SaveIcon from "@mui/icons-material/Save";
import { enqueueSnackbar } from "notistack";
import { apiUrl } from "./LoginSignup";

const emptyNetwork = { label: "", value: "", enabled: true };

const SecuritySettings = () => {
  const userSession = JSON.parse(localStorage.getItem("userSession")) || {};
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ipRestrictionEnabled, setIpRestrictionEnabled] = useState(false);
  const [allowlist, setAllowlist] = useState([]);
  const [newNetwork, setNewNetwork] = useState(emptyNetwork);
  const [currentIp, setCurrentIp] = useState(null);

  const headers = {
    "Content-Type": "application/json",
    authorization: userSession.token,
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiUrl}/security/settings`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load security settings");

      setIpRestrictionEnabled(Boolean(data.ipRestrictionEnabled));
      setAllowlist(Array.isArray(data.allowlist) ? data.allowlist : []);
    } catch (error) {
      enqueueSnackbar(error.message, { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const scanCurrentIp = async () => {
    try {
      const res = await fetch(`${apiUrl}/security/current-ip`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to scan current IP");
      setCurrentIp(data);
    } catch (error) {
      enqueueSnackbar(error.message, { variant: "error" });
    }
  };

  useEffect(() => {
    fetchSettings();
    scanCurrentIp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateNetwork = (index, patch) => {
    setAllowlist((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const addNetwork = (network = newNetwork) => {
    const value = (network.value || "").trim();
    if (!value) {
      enqueueSnackbar("Enter an IP address or CIDR network", { variant: "warning" });
      return;
    }

    if (allowlist.some((item) => item.value === value)) {
      enqueueSnackbar("This network is already in the allowlist", { variant: "info" });
      return;
    }

    setAllowlist((prev) => [
      ...prev,
      {
        label: network.label?.trim() || "Office Network",
        value,
        enabled: network.enabled !== false,
      },
    ]);
    setNewNetwork(emptyNetwork);
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      const res = await fetch(`${apiUrl}/security/settings`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ ipRestrictionEnabled, allowlist }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save security settings");

      setIpRestrictionEnabled(Boolean(data.ipRestrictionEnabled));
      setAllowlist(Array.isArray(data.allowlist) ? data.allowlist : []);
      enqueueSnackbar("Security settings saved", { variant: "success" });
      scanCurrentIp();
    } catch (error) {
      enqueueSnackbar(error.message, { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const addCurrentIp = () => {
    if (!currentIp?.ip) return;
    addNetwork({
      label: "Current IP",
      value: currentIp.ip,
      enabled: true,
    });
  };

  return (
    <Box sx={{ maxWidth: 1120, mx: "auto" }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Security
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Restrict employee portal access to approved office IP addresses or CIDR networks.
      </Typography>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }} justifyContent="space-between">
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Employee IP Restriction
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Admin, dev, director and super admin roles remain able to access and manage this page.
              </Typography>
            </Box>
            <FormControlLabel
              control={<Switch checked={ipRestrictionEnabled} onChange={(e) => setIpRestrictionEnabled(e.target.checked)} />}
              label={ipRestrictionEnabled ? "Enabled" : "Disabled"}
            />
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                Quick IP Scanner
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                This is the IP address your server sees for your current connection.
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <Chip
                  label={currentIp?.ip || "Not scanned"}
                  color={currentIp?.allowed ? "success" : "default"}
                  variant="outlined"
                  sx={{ fontWeight: 700 }}
                />
                {currentIp?.matchedNetwork && <Chip size="small" color="success" label={`Matched: ${currentIp.matchedNetwork.value}`} />}
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button variant="outlined" startIcon={<MyLocationIcon />} onClick={scanCurrentIp}>
                  Scan Current IP
                </Button>
                <Button variant="contained" startIcon={<AddIcon />} onClick={addCurrentIp} disabled={!currentIp?.ip}>
                  Add Current IP
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                Add Approved Network
              </Typography>
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Label"
                    value={newNetwork.label}
                    onChange={(e) => setNewNetwork((prev) => ({ ...prev, label: e.target.value }))}
                    placeholder="Noida Office"
                  />
                </Grid>
                <Grid item xs={12} sm={5}>
                  <TextField
                    fullWidth
                    label="IP / CIDR Network"
                    value={newNetwork.value}
                    onChange={(e) => setNewNetwork((prev) => ({ ...prev, value: e.target.value }))}
                    placeholder="203.0.113.10 or 203.0.113.0/24"
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Button fullWidth sx={{ height: "100%" }} variant="contained" startIcon={<AddIcon />} onClick={() => addNetwork()}>
                    Add
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Allowed IP Networks
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Use the switch to temporarily allow or block an entry without deleting it.
              </Typography>
            </Box>
            <Button variant="contained" startIcon={<SaveIcon />} onClick={saveSettings} disabled={saving || loading}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </Stack>

          {ipRestrictionEnabled && allowlist.filter((item) => item.enabled).length === 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Restriction is enabled but no active networks are listed. Non-admin employees will be blocked.
            </Alert>
          )}

          <Stack divider={<Divider />} spacing={0}>
            {allowlist.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                No networks added yet.
              </Typography>
            ) : (
              allowlist.map((item, index) => (
                <Grid container spacing={1.5} alignItems="center" key={item._id || `${item.value}-${index}`} sx={{ py: 1.5 }}>
                  <Grid item xs={12} md={3}>
                    <TextField fullWidth size="small" label="Label" value={item.label || ""} onChange={(e) => updateNetwork(index, { label: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} md={5}>
                    <TextField fullWidth size="small" label="IP / CIDR Network" value={item.value || ""} onChange={(e) => updateNetwork(index, { value: e.target.value })} />
                  </Grid>
                  <Grid item xs={8} md={3}>
                    <FormControlLabel
                      control={<Switch checked={Boolean(item.enabled)} onChange={(e) => updateNetwork(index, { enabled: e.target.checked })} />}
                      label={item.enabled ? "Allowed" : "Blocked"}
                    />
                  </Grid>
                  <Grid item xs={4} md={1} sx={{ textAlign: "right" }}>
                    <IconButton color="error" onClick={() => setAllowlist((prev) => prev.filter((_, idx) => idx !== index))}>
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Grid>
                </Grid>
              ))
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SecuritySettings;
