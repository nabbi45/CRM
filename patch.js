const fs = require('fs');

const path = 'CRM_FRONTEND/src/components/TeamInbox.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Add States
const stateTarget = `const [selectedMessage, setSelectedMessage] = useState(null);`;
const stateReplacement = `const [selectedMessage, setSelectedMessage] = useState(null);
    const [groupMenuAnchor, setGroupMenuAnchor] = useState(null);
    const [manageGroupDialogOpen, setManageGroupDialogOpen] = useState(false);
    const [editingGroupMembers, setEditingGroupMembers] = useState([]);`;
content = content.replace(stateTarget, stateReplacement);

// 2. Add Handlers
const handlerTarget = `    // Determine active contact formatting
    const activeUser = !activeChat.isGlobal && !activeChat.isGroup ? users.find(u => u._id === activeChat.id) : null;`;
const handlerReplacement = `    const handleGroupMenuOpen = (e) => setGroupMenuAnchor(e.currentTarget);
    const handleGroupMenuClose = () => setGroupMenuAnchor(null);

    const handleManageGroupOpen = () => {
        handleGroupMenuClose();
        if (activeChat.isGroup) {
            setEditingGroupMembers(activeChat.members?.map(m => m.user_id) || []);
            setManageGroupDialogOpen(true);
        }
    };

    const handleDeleteGroup = async () => {
        handleGroupMenuClose();
        if (!window.confirm('Are you sure you want to delete this group?')) return;
        try {
            const res = await fetch(\`\${apiUrl}/chat/groups/\${activeChat.id}\`, { method: 'DELETE', headers });
            if (res.ok) {
                setGroups(prev => prev.filter(g => g._id !== activeChat.id));
                setActiveChat({ id: 'global', name: 'All Company', isGlobal: true });
                enqueueSnackbar('Group deleted', { variant: 'success' });
            } else {
                const error = await res.json();
                enqueueSnackbar(error.message || 'Failed to delete group', { variant: 'error' });
            }
        } catch (error) {
            enqueueSnackbar('Error deleting group', { variant: 'error' });
        }
    };

    const toggleManageGroupMember = (userId) => {
        setEditingGroupMembers((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
        );
    };

    const handleUpdateGroupMembers = async () => {
        try {
            const res = await fetch(\`\${apiUrl}/chat/groups/\${activeChat.id}/members\`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ memberIds: editingGroupMembers }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setGroups(prev => prev.map(g => g._id === activeChat.id ? data.group : g));
                setActiveChat(prev => ({ ...prev, members: data.group.members, created_by: data.group.created_by }));
                setManageGroupDialogOpen(false);
                enqueueSnackbar('Members updated', { variant: 'success' });
            } else {
                enqueueSnackbar(data.message || 'Failed to update members', { variant: 'error' });
            }
        } catch (error) {
            enqueueSnackbar('Error updating members', { variant: 'error' });
        }
    };

    // Determine active contact formatting
    const activeUser = !activeChat.isGlobal && !activeChat.isGroup ? users.find(u => u._id === activeChat.id) : null;`;
content = content.replace(handlerTarget, handlerReplacement);

// 3. Add created_by to setActiveChat
const setActiveChatTarget = `setActiveChat({ id: group._id, name: group.name, isGroup: true, members: group.members || [] });`;
const setActiveChatReplacement = `setActiveChat({ id: group._id, name: group.name, isGroup: true, members: group.members || [], created_by: group.created_by });`;
content = content.replace(setActiveChatTarget, setActiveChatReplacement);

// 4. Group Menu Icon in Header
const headerIconTarget = `                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton size="small"><MoreVertIcon /></IconButton>
                    </Box>`;
const headerIconReplacement = `                    {activeChat.isGroup && (activeChat.created_by === session.user_id || canCreateGroup) && (
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <IconButton size="small" onClick={handleGroupMenuOpen}><MoreVertIcon /></IconButton>
                        </Box>
                    )}`;
content = content.replace(headerIconTarget, headerIconReplacement);

// 5. Add Dialog and Menu
const dialogTarget = `                </DialogActions>
            </Dialog>

        </Box>`;
const dialogReplacement = `                </DialogActions>
            </Dialog>

            {/* Group Management Menu */}
            <Menu
                anchorEl={groupMenuAnchor}
                open={Boolean(groupMenuAnchor)}
                onClose={handleGroupMenuClose}
            >
                <MenuItem onClick={handleManageGroupOpen}>Edit Members</MenuItem>
                <MenuItem onClick={handleDeleteGroup} sx={{ color: '#ef4444' }}>Delete Group</MenuItem>
            </Menu>

            {/* Manage Group Dialog */}
            <Dialog open={manageGroupDialogOpen} onClose={() => setManageGroupDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Manage Group Members</DialogTitle>
                <DialogContent>
                    <Box sx={{ maxHeight: 280, overflowY: 'auto', mt: 1 }}>
                        {users.filter((u) => u._id !== session.user_id && u._id !== activeChat.created_by).map((u) => (
                            <FormControlLabel
                                key={u._id}
                                control={
                                    <Checkbox
                                        checked={editingGroupMembers.includes(u._id)}
                                        onChange={() => toggleManageGroupMember(u._id)}
                                    />
                                }
                                label={u.name}
                            />
                        ))}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setManageGroupDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleUpdateGroupMembers}>Save</Button>
                </DialogActions>
            </Dialog>

        </Box>`;
content = content.replace(dialogTarget, dialogReplacement);

fs.writeFileSync(path, content, 'utf8');
console.log('Done');
