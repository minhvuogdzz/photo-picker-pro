import { X, CheckCircle2 } from "lucide-react";

interface TermsDialogProps {
  onClose: () => void;
  onAgree?: () => void;
  showAgreeButton?: boolean;
}

export function TermsDialog({ onClose, onAgree, showAgreeButton = false }: TermsDialogProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="panel w-full max-w-3xl bg-card/90 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-2xl flex flex-col max-h-[85vh] animate-slide-up">
        <div className="p-6 border-b border-white/10 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-foreground">Điều khoản và Dịch vụ</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl leading-none">&times;</button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-8 text-sm text-muted-foreground leading-relaxed custom-scrollbar">
          
          {/* PHẦN TIẾNG VIỆT */}
          <div className="space-y-6">
            <div className="border-b border-white/10 pb-4">
              <p className="font-bold text-foreground text-lg uppercase tracking-wide">MVD PHOTOSHOP ACADEMY</p>
              <p className="text-primary font-semibold">THỎA THUẬN CUNG CẤP VÀ SỬ DỤNG DỊCH VỤ (TERMS OF SERVICE)</p>
              <p className="text-xs mt-2">Cập nhật lần cuối: Tháng 8/2026</p>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-bold text-foreground">Điều 1: Chấp nhận điều khoản</h3>
              <p>Bằng việc đăng ký, đăng nhập và sử dụng phần mềm MVD Photoshop Academy, bạn (Người dùng) xác nhận đã đọc, hiểu và đồng ý bị ràng buộc bởi các điều khoản, điều kiện này. Nếu bạn không đồng ý với bất kỳ phần nào của thỏa thuận, vui lòng ngưng sử dụng dịch vụ và gỡ cài đặt phần mềm ngay lập tức.</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-foreground">Điều 2: Giấy phép sử dụng & Quyền Sở Hữu Trí Tuệ</h3>
              <p>2.1. MVD Photoshop Academy cấp cho bạn một giấy phép không độc quyền, không thể chuyển nhượng, và có thể thu hồi để sử dụng phần mềm cho mục đích cá nhân hoặc thương mại (tùy thuộc vào gói dịch vụ bạn đã mua).</p>
              <p>2.2. Toàn bộ nội dung, bộ lọc ảnh (presets), thuật toán, mã nguồn, đồ họa, logo và tài liệu hướng dẫn thuộc sở hữu độc quyền của MVD, được bảo vệ bởi luật Sở hữu trí tuệ Việt Nam và quốc tế.</p>
              <p>2.3. Nghiêm cấm mọi hành vi sao chép, phát tán, bán lại, cho thuê tài khoản hoặc sử dụng công nghệ biên dịch ngược (reverse engineering) đối với bất kỳ thành phần nào của phần mềm.</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-foreground">Điều 3: Trách Nhiệm Người Dùng & Các Hành Vi Bị Cấm</h3>
              <p>3.1. Người dùng có trách nhiệm bảo mật thông tin tài khoản (Tên đăng nhập, Mật khẩu). Mọi hành vi truy cập từ tài khoản của bạn sẽ được xem là do chính bạn thực hiện và chịu trách nhiệm.</p>
              <p>3.2. Chúng tôi có hệ thống phát hiện chia sẻ tài khoản (multi-device login/account sharing). Việc cố tình share tài khoản cho nhiều người sử dụng vi phạm chính sách của chúng tôi và sẽ dẫn đến việc tài khoản bị khóa vĩnh viễn không cần báo trước, đồng thời không được hoàn tiền.</p>
              <p>3.3. Cấm sử dụng phần mềm để chỉnh sửa, tạo ra hoặc phát tán nội dung vi phạm pháp luật, đồi trụy, thù địch, hoặc xâm phạm quyền riêng tư/bản quyền của bên thứ ba.</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-foreground">Điều 4: Thanh Toán, Gia Hạn & Hoàn Tiền</h3>
              <p>4.1. Dịch vụ được cung cấp dựa trên các gói thuê bao (subscription). Phí dịch vụ phải được thanh toán trước qua các cổng thanh toán được hệ thống hỗ trợ.</p>
              <p>4.2. Khách hàng có trách nhiệm tự quản lý việc gia hạn. Dịch vụ có thể bị tạm ngưng nếu quá trình thanh toán gia hạn không thành công.</p>
              <p>4.3. <b>Chính sách hoàn tiền:</b> MVD Photoshop Academy cung cấp sản phẩm nội dung số. Chúng tôi KHÔNG HỖ TRỢ HOÀN TIỀN cho các giao dịch đã thực hiện thành công, ngoại trừ trường hợp lỗi kỹ thuật nghiêm trọng xuất phát từ phía phần mềm khiến bạn không thể sử dụng dịch vụ trong suốt 7 ngày liên tục kể từ lúc mua.</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-foreground">Điều 5: Thu Thập Và Bảo Mật Dữ Liệu</h3>
              <p>5.1. Chúng tôi cam kết tôn trọng quyền riêng tư của bạn. Dữ liệu hình ảnh của bạn chỉ được xử lý cục bộ trên thiết bị của bạn hoặc mã hóa an toàn trên máy chủ đám mây của chúng tôi. MVD Academy không lưu trữ vĩnh viễn và không phân tích hình ảnh của khách hàng phục vụ mục đích khác.</p>
              <p>5.2. Thông tin cá nhân (Email, Tên, Định danh thiết bị phần cứng) chỉ được thu thập nhằm mục đích xác thực tài khoản, chống gian lận và hỗ trợ kỹ thuật.</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-foreground">Điều 6: Tuyên Bố Từ Chối Bảo Đảm & Giới Hạn Trách Nhiệm</h3>
              <p>6.1. Phần mềm được cung cấp ở trạng thái "nguyên bản" (AS IS) và "có sẵn" (AS AVAILABLE). MVD không đảm bảo phần mềm sẽ tương thích 100% với mọi cấu hình phần cứng hoặc hoạt động không có bất kỳ lỗi nhỏ nào.</p>
              <p>6.2. Trong mọi trường hợp, MVD Academy, bao gồm cả ban giám đốc, nhân viên, và đối tác, sẽ không chịu trách nhiệm đối với bất kỳ thiệt hại gián tiếp, mất mát dữ liệu, mất mát dự án cá nhân hoặc tổn thất lợi nhuận nào phát sinh từ việc sử dụng hoặc không thể sử dụng phần mềm.</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-foreground">Điều 7: Chấm Dứt Dịch Vụ</h3>
              <p>Chúng tôi bảo lưu quyền đình chỉ hoặc chấm dứt tài khoản của bạn ngay lập tức, không cần thông báo trước, nếu phát hiện bạn vi phạm bất kỳ điều khoản nào trong Thỏa thuận này (đặc biệt là hành vi chia sẻ tài khoản hoặc sử dụng phần mềm bất hợp pháp).</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-foreground">Điều 8: Sửa Đổi Điều Khoản</h3>
              <p>MVD Photoshop Academy có quyền sửa đổi các điều khoản này bất cứ lúc nào. Các thay đổi sẽ có hiệu lực ngay khi được cập nhật trên hệ thống. Việc bạn tiếp tục sử dụng dịch vụ đồng nghĩa với việc chấp nhận các điều khoản mới nhất.</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-foreground">Điều 9: Luật Áp Dụng & Giải Quyết Tranh Chấp</h3>
              <p>Thỏa thuận này được điều chỉnh và giải thích theo luật pháp của nước Cộng hòa Xã hội Chủ nghĩa Việt Nam. Mọi tranh chấp phát sinh từ hoặc liên quan đến thỏa thuận này sẽ được ưu tiên giải quyết thông qua thương lượng hòa bình.</p>
            </div>
          </div>

          {/* PHẦN TIẾNG ANH (ENGLISH TRANSLATION) */}
          <div className="space-y-6 pt-8 border-t border-white/20 mt-8">
            <div className="border-b border-white/10 pb-4">
              <p className="font-bold text-foreground text-lg uppercase tracking-wide">ENGLISH VERSION</p>
              <p className="text-primary font-semibold">TERMS OF SERVICE AGREEMENT</p>
              <p className="text-xs mt-2">Last Updated: August 2026</p>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-bold text-foreground">Article 1: Acceptance of Terms</h3>
              <p>By registering, logging in, and using the MVD Photoshop Academy software, you (the User) acknowledge that you have read, understood, and agreed to be bound by these terms and conditions. If you do not agree with any part of this agreement, please discontinue the use of our services immediately.</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-foreground">Article 2: License to Use & Intellectual Property</h3>
              <p>2.1. MVD Photoshop Academy grants you a non-exclusive, non-transferable, and revocable license to use the software for personal or commercial purposes (depending on your purchased subscription tier).</p>
              <p>2.2. All content, photo presets, algorithms, source code, graphics, logos, and documentation are the exclusive property of MVD and are protected by Vietnamese and international intellectual property laws.</p>
              <p>2.3. Strictly prohibited actions include copying, distributing, reselling, account renting, or reverse engineering any component of the software.</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-foreground">Article 3: User Responsibilities & Prohibited Conduct</h3>
              <p>3.1. Users are responsible for maintaining the confidentiality of their account information (Username, Password). Any access from your account is deemed to be performed and authorized by you.</p>
              <p>3.2. We utilize an automated system to detect account sharing (multi-device login). Intentional sharing of your account with multiple users violates our policy and will result in a permanent ban without prior notice and without a refund.</p>
              <p>3.3. It is prohibited to use the software to edit, create, or distribute content that is illegal, explicit, hateful, or infringes upon the privacy or copyright of third parties.</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-foreground">Article 4: Payment, Renewal & Refunds</h3>
              <p>4.1. Services are provided on a subscription basis. Service fees must be paid in advance via our supported payment gateways.</p>
              <p>4.2. Customers are responsible for managing their renewals. Services may be suspended if a renewal payment fails.</p>
              <p>4.3. <b>Refund Policy:</b> MVD Photoshop Academy provides digital software products. We DO NOT OFFER REFUNDS for successful transactions, except in cases where a critical technical failure on our end prevents you from using the service for 7 consecutive days from the time of purchase.</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-foreground">Article 5: Data Collection & Privacy</h3>
              <p>5.1. We respect your privacy. Your image data is processed locally on your device or securely encrypted on our cloud servers. MVD Academy does not permanently store or analyze your images for any other purposes.</p>
              <p>5.2. Personal information (Email, Name, Hardware Device ID) is collected solely for account authentication, fraud prevention, and technical support.</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-foreground">Article 6: Disclaimer of Warranties & Limitation of Liability</h3>
              <p>6.1. The software is provided "AS IS" and "AS AVAILABLE". MVD does not guarantee that the software will be 100% compatible with all hardware configurations or operate completely bug-free.</p>
              <p>6.2. Under no circumstances shall MVD Academy, its directors, employees, or affiliates be liable for any indirect damages, data loss, personal project loss, or profit loss arising from the use or inability to use the software.</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-foreground">Article 7: Termination of Service</h3>
              <p>We reserve the right to suspend or terminate your account immediately, without prior notice, if we discover that you have violated any terms in this Agreement (especially regarding account sharing or illegal software usage).</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-foreground">Article 8: Modifications to Terms</h3>
              <p>MVD Photoshop Academy reserves the right to modify these terms at any time. Changes will take effect immediately upon being updated in the system. Your continued use of the service signifies your acceptance of the latest terms.</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-foreground">Article 9: Governing Law</h3>
              <p>This agreement is governed by and construed in accordance with the laws of the Socialist Republic of Vietnam. Any disputes arising from or relating to this agreement shall be prioritized for resolution through amicable negotiation.</p>
            </div>
          </div>

          {/* Action Button */}
          {showAgreeButton && (
            <div className="pt-8 mt-4 pb-2 border-t border-white/10 flex justify-end sticky bottom-0 bg-card/95 backdrop-blur-md">
              <button 
                type="button" 
                className="btn-primary py-3.5 px-8 text-sm font-bold w-full sm:w-auto flex items-center justify-center gap-2 shadow-lg"
                onClick={() => {
                  onAgree?.();
                  onClose();
                }}
              >
                <CheckCircle2 size={18} />
                Tôi đã đọc và Đồng ý (I Agree)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
