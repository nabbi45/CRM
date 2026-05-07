const fs = require('fs');

// 1. Rename ProcessDocuments.js -> ClientDocuments.js
const oldComponentPath = 'CRM_FRONTEND/src/components/ProcessDocuments.js';
const newComponentPath = 'CRM_FRONTEND/src/components/ClientDocuments.js';

if (fs.existsSync(oldComponentPath)) {
    let content = fs.readFileSync(oldComponentPath, 'utf8');
    content = content.replace(/ProcessDocuments/g, 'ClientDocuments');
    content = content.replace(/Process Documents/g, 'Client Documents');
    content = content.replace(/process_documents/g, 'client_documents');
    fs.writeFileSync(newComponentPath, content, 'utf8');
    fs.unlinkSync(oldComponentPath);
    console.log('Renamed ProcessDocuments.js to ClientDocuments.js');
}

// 2. Dashboard.js
const dashPath = 'CRM_FRONTEND/src/Pages/Dashboard.js';
if (fs.existsSync(dashPath)) {
    let dashContent = fs.readFileSync(dashPath, 'utf8');
    dashContent = dashContent.replace(/ProcessDocuments/g, 'ClientDocuments');
    dashContent = dashContent.replace(/process_documents/g, 'client_documents');
    fs.writeFileSync(dashPath, dashContent, 'utf8');
    console.log('Updated Dashboard.js');
}

// 3. Sidebar.js
const sidebarPath = 'CRM_FRONTEND/src/components/Sidebar.js';
if (fs.existsSync(sidebarPath)) {
    let sideContent = fs.readFileSync(sidebarPath, 'utf8');
    sideContent = sideContent.replace(/process_documents/g, 'client_documents');
    sideContent = sideContent.replace(/Process Documents/g, 'Client Documents');
    fs.writeFileSync(sidebarPath, sideContent, 'utf8');
    console.log('Updated Sidebar.js');
}

// 4. featureAccess.js
const featureAccessPath = 'CRM_FRONTEND/src/utils/featureAccess.js';
if (fs.existsSync(featureAccessPath)) {
    let featureContent = fs.readFileSync(featureAccessPath, 'utf8');
    featureContent = featureContent.replace(/'process_documents'/g, "'client_documents'");
    featureContent = featureContent.replace(/process_documents: 'Process Documents'/g, "client_documents: 'Client Documents'");
    
    // Add backward compatibility
    if (!featureContent.includes("list.push('client_documents')")) {
        const replaceTarget = "if (list.includes('leave_management')) list.push('timecard');";
        const replacement = "if (list.includes('leave_management')) list.push('timecard');\n  if (list.includes('process_documents')) list.push('client_documents');";
        featureContent = featureContent.replace(replaceTarget, replacement);
    }
    
    fs.writeFileSync(featureAccessPath, featureContent, 'utf8');
    console.log('Updated featureAccess.js');
}

// 5. Userroutes.js
const userRoutePath = 'CRM_BACKEND/src/routes/Userroutes.js';
if (fs.existsSync(userRoutePath)) {
    let userRouteContent = fs.readFileSync(userRoutePath, 'utf8');
    userRouteContent = userRouteContent.replace(/process_documents/g, 'client_documents');
    fs.writeFileSync(userRoutePath, userRouteContent, 'utf8');
    console.log('Updated Userroutes.js');
}

// 6. BookingDocumentRoute.js
const bookingDocPath = 'CRM_BACKEND/src/routes/BookingDocumentRoute.js';
if (fs.existsSync(bookingDocPath)) {
    let bookingDocContent = fs.readFileSync(bookingDocPath, 'utf8');
    bookingDocContent = bookingDocContent.replace(/Process Document/g, 'Client Document');
    fs.writeFileSync(bookingDocPath, bookingDocContent, 'utf8');
    console.log('Updated BookingDocumentRoute.js');
}

// 7. Tests
const oldTestPath = 'CRM_FRONTEND/src/tests/processDocuments.test.js';
const newTestPath = 'CRM_FRONTEND/src/tests/clientDocuments.test.js';
if (fs.existsSync(oldTestPath)) {
    let testContent = fs.readFileSync(oldTestPath, 'utf8');
    testContent = testContent.replace(/ProcessDocuments/g, 'ClientDocuments');
    testContent = testContent.replace(/Process Documents/g, 'Client Documents');
    testContent = testContent.replace(/process_documents/g, 'client_documents');
    fs.writeFileSync(newTestPath, testContent, 'utf8');
    fs.unlinkSync(oldTestPath);
    console.log('Renamed processDocuments.test.js to clientDocuments.test.js');
}
