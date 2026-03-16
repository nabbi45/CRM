import express from "express";
import { BookingModel } from "../models/bookingModel.js";
import { CompanyProfileModel } from "../models/CompanyProfileModel.js";
import { DocumentModel } from "../models/DocumentModel.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";

const AgreementRoute = express.Router();

AgreementRoute.get("/:bookingId", authenticateUser, async (req, res) => {
  try {
    const booking = await BookingModel.findById(req.params.bookingId);
    if (!booking) {
      return res.status(404).send({ message: "Booking not found" });
    }

    let companyProfile = await CompanyProfileModel.findOne();
    if (!companyProfile) {
      companyProfile = {
        company_name: "GROWTHERA VENTURES PRIVATE LIMITED",
        address: "M-1 ARV PARK, office No.G-02, Noida, Uttar Pradesh, Sec-63 201301",
        logo_url: `${req.protocol}://${req.get('host')}/assets/logo.png`,
        seal_url: `${req.protocol}://${req.get('host')}/assets/Growthera%20Digital%20Stamp.jpg`
      };
    } else {
      if (!companyProfile.logo_url) companyProfile.logo_url = `${req.protocol}://${req.get('host')}/assets/logo.png`;
      if (!companyProfile.seal_url) companyProfile.seal_url = `${req.protocol}://${req.get('host')}/assets/Growthera%20Digital%20Stamp.jpg`;
    }

    const latestInvoice = await DocumentModel.findOne({ bookingId: req.params.bookingId, type: 'Invoice' }).sort({ createdAt: -1 });
    let totalAmount = booking.total_amount;
    let gstText = "";

    if (latestInvoice && latestInvoice.invoiceData) {
      totalAmount = latestInvoice.invoiceData.subtotal || booking.total_amount;
      if (latestInvoice.invoiceData.includeGst) {
        gstText = ` + ${latestInvoice.invoiceData.gstRate}% GST`;
      }
    } else {
      // Fallback to existing booking total and hardcoded 18% if no invoice exists yet
      gstText = " + 18% GST";
    }

    const date = new Date().toLocaleDateString('en-GB');

    const sealImgFirst = companyProfile.seal_url ? `<img src="${companyProfile.seal_url}" alt="Seal" style="max-height: 90px; position: absolute; left: 15%; bottom: 65px; opacity: 0.8; mix-blend-mode: multiply;" />` : '';
    const sealImgSecond = companyProfile.seal_url ? `<img src="${companyProfile.seal_url}" alt="Seal" style="max-height: 90px; position: absolute; right: 15%; bottom: 65px; opacity: 0.8; mix-blend-mode: multiply;" />` : '';

    const afterDisbursementItem = booking.after_disbursement && booking.after_disbursement !== "" ? `<li style="margin-bottom: 5px;"><strong>${booking.after_disbursement}</strong> of the funding amount after fund disbursement.</li>` : '';

    const agreementHtml = `
      <div style="padding: 40px; font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0 auto; background: #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-radius: 8px;">
        <h2 style="text-align: center; color: #1e3a8a; font-weight: 700; border-bottom: 3px solid #1e3a8a; padding-bottom: 15px; text-transform: uppercase; letter-spacing: 1px;">CONSULTANCY SERVICE AGREEMENT</h2>
        
        <p style="margin-top: 30px; font-size: 1.05rem; text-align: justify;">THIS CONSULTANCY SERVICE AGREEMENT (The "Agreement") is entered into this <strong>${date}</strong>, by and between the <strong>${companyProfile.company_name}</strong> ("Here into referred as Service Provider") having its principal place of business <strong>${companyProfile.address}</strong> and <strong>${booking.company_name || booking.contact_person}</strong> ("Hereinto referred as Service Receiver") having its principal place of business registered at <strong>${booking.state}</strong>.</p>
        
        <p style="text-align: justify;">WHEREAS, the service provider is ready and willing for providing consultancy services for the purpose of assisting the service receiver for availing benefits under VENTURE CAPITAL, CERTIFICATES, GRANTS & LOANS SCHEME (1 YEAR CONSULTANCY SERVICE) and by assisting them in filling up forms and completing documentation as required under the scheme.</p>
        
        <h4 style="margin-top: 30px; font-weight: bold; font-size: 1.15rem; color: #1e3a8a; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">1) Definitions:</h4>
        <ul style="list-style-type: none; padding-left: 10px; margin-top: 15px;">
          <li style="margin-bottom: 12px; text-align: justify;"><strong>a) Agreement:</strong> Agreement shall mean this Agreement and all annexure(s) to this Agreement and amendments made to this Agreement from time to time in writing with the consent of both the Parties, in accordance with the provisions of this Agreement.</li>
          <li style="margin-bottom: 12px; text-align: justify;"><strong>b) Service Provider:</strong> The person who is giving specified service in this agreement in exchange for a payment.</li>
          <li style="text-align: justify;"><strong>c) Service Receiver:</strong> Service receiver is a person who receives or avails the service provided by the service provider.</li>
        </ul>

        <h4 style="margin-top: 30px; font-weight: bold; font-size: 1.15rem; color: #1e3a8a; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">2) Covenants of the Service Provider:</h4>
        <ul style="list-style-type: none; padding-left: 10px; margin-top: 15px;">
          <li style="margin-bottom: 12px; text-align: justify;"><strong>a)</strong> WHEREAS the Service Provider will be preparing all the documents that are required for the purpose of filing an application for availing benefits under VENTURE CAPITAL, CERTIFICATES, GRANTS & LOANS SCHEME (1 YEAR CONSULTANCY SERVICE) On receipt of required data and details from the Service receiver and after preparing required reports and documents, Service Provider will submit the application on behalf of the Service Receiver if so requested by the Service receiver.</li>
          <li style="text-align: justify;"><strong>b)</strong> WHEREAS the service provider assures and is obliged to maintain the secrecy of the information/documents and undertakes that under any circumstances, the said information will not be released to anyone except to the authorized employees of the company.</li>
        </ul>

        <h4 style="margin-top: 30px; font-weight: bold; font-size: 1.15rem; color: #1e3a8a; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">3) Covenants of the Service Receiver:</h4>
        <ul style="list-style-type: none; padding-left: 10px; margin-top: 15px;">
          <li style="margin-bottom: 15px; text-align: justify;"><strong>a)</strong> WHEREAS the Service Receiver acknowledges that the Registration Process will be subject to many changes in the criteria as set out by the Government of India and the Service Receiver has no objection if an extension of time is sought by the service provider in such cases.</li>
          <li style="margin-bottom: 15px; text-align: justify;">
            <strong>b)</strong> WHEREAS the service receiver shall pay an amount of <strong>Rs. ${totalAmount}${gstText}</strong> the consultancy fees to the service provider as follow:
            <ul style="list-style-type: circle; margin-top: 10px; padding-left: 25px; margin-bottom: 10px;">
                ${booking.term_1 ? `<li style="margin-bottom: 5px;">First Stage <strong>Rs. ${booking.term_1}${gstText}</strong> (To Be Paid) of the amount at the time of signing and executing the agreement.</li>` : ''}
                ${booking.term_2 ? `<li style="margin-bottom: 5px;">Second Stage <strong>Rs. ${booking.term_2}${gstText}</strong> will be receive after applications.</li>` : ''}
                ${afterDisbursementItem}
            </ul>
            <span style="display: block; margin-top: 10px;">WHEREAS the Service Receiver must provide all the necessary documents called upon by the Service Provider for the Registration Process in order to prepare necessary reports and documentation for making the application during the term of this Agreement.</span>
          </li>
          <li style="margin-bottom: 12px; text-align: justify;"><strong>c)</strong> WHEREAS the Service Receiver acknowledges that the consultancy fees are Non-refundable.</li>
          <li style="text-align: justify;"><strong>d)</strong> WHEREAS the service receiver agrees the service provider shall start providing his services only once the payment as stated in clause (b) is made.</li>
        </ul>

        <h4 style="margin-top: 30px; font-weight: bold; font-size: 1.15rem; color: #1e3a8a; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">4) Term:</h4>
        <p style="text-align: justify; margin-top: 10px;">This agreement shall be valid, effective, and binding on both the Parties for a tenure of 1 (One) year commencing from the date of execution.</p>

        <h4 style="margin-top: 25px; font-weight: bold; font-size: 1.15rem; color: #1e3a8a; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">5) Termination:</h4>
        <p style="text-align: justify; margin-top: 10px;">Either party may terminate this Agreement at any time by giving prior written notice of not less than thirty (30) days to the other party by assigning the reason for the termination. Termination under any of the provisions of this Agreement shall be without prejudice to the service provider's right to get paid by the service receiver for the service rendered till the date of Termination.</p>

        <h4 style="margin-top: 25px; font-weight: bold; font-size: 1.15rem; color: #1e3a8a; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">6) Relationship:</h4>
        <p style="text-align: justify; margin-top: 10px;">Each Party hereto is an independent contractor, responsible for its own actions. Nothing in this Agreement shall be deemed to constitute or form an employment relationship, partnership, agency or other form of business relationship. Neither party shall have the right or authority to create any obligation, whether express or implied, on behalf of the other.</p>

        <h4 style="margin-top: 25px; font-weight: bold; font-size: 1.15rem; color: #1e3a8a; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">7) Third Parties:</h4>
        <p style="text-align: justify; margin-top: 10px;">This Agreement does not and shall not be deemed to confer upon any third party any right to claim damages to bring suit, or other proceeding against either the service receiver or service provider because of any term contained in this Agreement.</p>

        <h4 style="margin-top: 25px; font-weight: bold; font-size: 1.15rem; color: #1e3a8a; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">8) Modification:</h4>
        <p style="text-align: justify; margin-top: 10px;">This Agreement may be modified or amended only by a duly authorized written instrument executed by the parties hereto by way of mutual understanding.</p>

        <h4 style="margin-top: 25px; font-weight: bold; font-size: 1.15rem; color: #1e3a8a; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">9) Severability:</h4>
        <p style="text-align: justify; margin-top: 10px;">If any of the provisions of this Agreement shall be invalid or unenforceable, such invalidity or unenforceability shall not invalidate or render unenforceable the entire Agreement, but rather the entire Agreement shall be construed as if not containing the particular invalid or unenforceable provision or provisions, and the rights and obligations of the party shall be construed and enforced accordingly, to effectuate the essential intent and purposes of this Agreement.</p>

        <h4 style="margin-top: 25px; font-weight: bold; font-size: 1.15rem; color: #1e3a8a; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">10) Enforcement and Waiver:</h4>
        <p style="text-align: justify; margin-top: 10px;">The failure of either party in any one or more instances to insist upon strict performance of any of the terms and provisions of this Agreement, shall not be construed as a waiver of the right to assert any such terms and provisions on any future occasion or of damages caused thereby.</p>

        <h4 style="margin-top: 25px; font-weight: bold; font-size: 1.15rem; color: #1e3a8a; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">11) Effective Date:</h4>
        <p style="text-align: justify; margin-top: 10px;">The effective date of this Agreement shall be the date first written above regardless of the date when the Agreement is actually signed or executed by both the parties.</p>

        <h4 style="margin-top: 25px; font-weight: bold; font-size: 1.15rem; color: #1e3a8a; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">12) Governing Law:</h4>
        <p style="text-align: justify; margin-top: 10px;">This Agreement shall be governed, in all respects in accordance with the laws of India and subject to the jurisdiction of Courts in Delhi.</p>

        <h4 style="margin-top: 25px; font-weight: bold; font-size: 1.15rem; color: #1e3a8a; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">13) Arbitration:</h4>
        <p style="text-align: justify; margin-top: 10px;">All disputes, differences and/or claims arising out of this Agreement shall be settled by arbitration in accordance with the Arbitration and Conciliation Act, 1996, and rules and regulations framed there under, and shall be referred to the sole Arbitrator appointed by both the parties after mutual consultation with each other. If the parties fail to come to an agreement for appointment of an arbitrator, the parties shall take a recourse for the appointment of arbitrator under Arbitration and Conciliation Act, 1996. The orders and award passed by the Arbitrator shall be final and binding on all the parties concerned. The arbitration proceedings shall be conducted in English and the venue of the Arbitration shall be at Delhi.</p>

        <h4 style="margin-top: 25px; font-weight: bold; font-size: 1.15rem; color: #1e3a8a; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">14) Notices:</h4>
        <p style="text-align: justify; margin-top: 10px;">Any and all notices, demands, or other communications required or desired to be given hereunder by any party hereto shall be in writing and shall be validly given or made to another party if personally served or if sent by Registered A/D. Post or by email at the address mentioned herein or the last known address of the Recipient party. Any party hereto may change its address by a written notice given in the manner provided above.</p>

        <h4 style="margin-top: 25px; font-weight: bold; font-size: 1.15rem; color: #1e3a8a; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">15) Entire Agreement:</h4>
        <p style="text-align: justify; margin-top: 10px;">This Agreement constitutes the entire agreement and understanding between the parties and supersedes any prior agreement or understanding relating to the subject matter of this Agreement.</p>

        <h4 style="margin-top: 25px; font-weight: bold; font-size: 1.15rem; color: #1e3a8a; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">16) Counterpart:</h4>
        <p style="text-align: justify; margin-top: 10px;">This Agreement may be executed in one or more counterparts, each of which will be deemed an original by which together will constitute one and the same instrument.</p>

        <p style="margin-top: 40px; font-weight: bold; text-align: center; color: #1e3a8a;">IN WITNESS WHEREOF, the parties have caused their duly authorized representatives to sign this CONSULTANCY SERVICE AGREEMENT as of the date first written above.</p>

        <div style="margin-top: 40px; display: flex; justify-content: space-between; align-items: stretch; background-color: #f8fafc; padding: 25px; border-radius: 8px; border: 1px solid #e2e8f0; position: relative;">
          ${sealImgFirst}
          <div style="width: 45%; display: flex; flex-direction: column;">
            <p style="color: #64748b; font-size: 0.9rem; text-transform: uppercase;">Signed and delivered for and on behalf of</p>
            <p style="font-weight: bold; font-size: 1.1rem; margin-top: 5px;">${companyProfile.company_name}</p>
            <p style="margin-top: 5px; color: #333;">Title: Authorized Representative</p>
            <p style="color: #333;">Date: ${date}</p>
            
            <div style="margin-top: 15px; height: 100px;"></div>
            
            <p style="border-top: 1px solid #cbd5e1; padding-top: 10px; margin-top: 0; width: 80%; color: #64748b;">Signature</p>
          </div>
          
          <div style="width: 45%; display: flex; flex-direction: column;">
             <p style="color: #64748b; font-size: 0.9rem;">I have read and understood the provisions of this Agreement & hereby accept the same.</p>
            <p style="font-weight: bold; font-size: 1.1rem; margin-top: 5px;">${booking.company_name || booking.contact_person}</p>
            <p style="margin-top: 5px; color: #333;">Title: Director/Authorized Person</p>
            <p style="color: #333;">Date: ${date}</p>
            
            <div style="margin-top: 15px; height: 100px; display: flex; align-items: flex-end;">
               <div style="height: 100%; width: 100%;"></div>
            </div>
            
            <p style="border-top: 1px solid #cbd5e1; padding-top: 10px; margin-top: 0; width: 80%; color: #64748b;">Signature</p>
          </div>
        </div>

        <div style="page-break-before: always; margin-top: 60px; padding-top: 40px; border-top: 2px dashed #cbd5e1;">
           <h2 style="text-align: center; color: #1e3a8a; text-transform: uppercase; font-weight: bold; letter-spacing: 2px; margin-bottom: 30px;">UNDERTAKING</h2>
           <p style="font-size: 1.1rem;">I, Director/Partner of <strong>${booking.company_name || booking.contact_person}</strong> do hereby undertake as under: -</p>
           
           <ol type="i" style="padding-left: 25px; line-height: 1.8; margin-top: 20px; font-size: 1.05rem;">
             <li style="margin-bottom: 15px;">That I will comply with all the sub clauses related to Clause (3). Failure to do so would result in forfeiture of the amount deposited for the rendering of Services by the Service Provider.</li>
             <li style="margin-bottom: 15px;">I understand that giving false information would result in forfeiture of the amount deposited for the rendering of Services and this agreement would be voidable at the option of the service provider.</li>
             <li style="margin-bottom: 15px;">I hereby acknowledge that I have read, understood and accepted all the terms and conditions mentioned on the website of Service Provider and the terms and conditions of this contract.</li>
           </ol>
           
           <div style="margin-top: 60px; display: flex; justify-content: space-between; align-items: flex-end; position: relative;">
             <div style="width: 45%;">
               <p style="color: #64748b; font-size: 0.9rem; text-transform: uppercase;">FOR AND ON BEHALF OF,</p>
               <p style="font-weight: bold; font-size: 1.1rem; margin-top: 5px;">${booking.company_name || booking.contact_person}</p>
               
               <div style="height: 80px;"></div>
               <p style="border-top: 1px solid #cbd5e1; padding-top: 10px; margin-top: 0; width: 80%; color: #64748b;">Signature</p>
               <p style="color: #333; margin-top: 5px;">Date: ${date}</p>
             </div>
             
             ${sealImgSecond}
             <div style="width: 45%; text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
                <p style="color: #64748b; font-size: 0.9rem; text-transform: uppercase;">Service Provider</p>
                <div style="margin-right: 20px; height: 100px;">
                </div>
                <div style="border-top: 1px solid #cbd5e1; width: 80%; margin-top: 0; padding-top: 10px; text-align: right;">
                    <p style="font-weight: bold; margin: 0;">${companyProfile.company_name}</p>
                </div>
             </div>
           </div>
        </div>
      </div>
    `;

    return res.status(200).send({ agreementHtml });
  } catch (error) {
    console.error("Error generating agreement:", error);
    return res.status(500).send({ message: "Error generating agreement HTML" });
  }
});

export default AgreementRoute;
