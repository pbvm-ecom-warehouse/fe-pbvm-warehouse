---
description: Lấy nội dung 1 GitHub issue và tự triển khai theo rule dự án fe-pbvm-warehouse
argument-hint: <issue-number-or-url>
---

Lấy issue GitHub và triển khai nó trong repo `fe-pbvm-warehouse`.

Issue cần xử lý: **$ARGUMENTS**

## Quy trình

1. **Lấy nội dung issue**
   ```bash
   gh issue view $ARGUMENTS --json number,title,body,labels,comments,url
   ```
   Nếu `$ARGUMENTS` trống, hỏi user số issue hoặc URL. Đọc kỹ cả `body` lẫn `comments` — comment sau thường chỉnh sửa/thu hẹp yêu cầu gốc.

2. **Xác định loại việc** dựa trên labels + nội dung:
   - Có label `bug` / mô tả lỗi cụ thể → dùng skill `superpowers:systematic-debugging` trước khi sửa.
   - Feature / thay đổi UI, hành vi → dùng skill `superpowers:brainstorming` nếu yêu cầu chưa rõ, rồi `superpowers:test-driven-development` khi code.
   - Việc lớn, nhiều bước → cân nhắc `superpowers:writing-plans` trước khi động code.

3. **Đối chiếu với rule dự án** — đọc `AGENTS.md`, `.codex/codex.md`, `.codex/rules/*.md` trước khi code:
   - Đây là Next.js đã có breaking changes so với kiến thức train sẵn — đọc guide liên quan trong `node_modules/next/dist/docs/` trước khi dùng API Next.js không chắc chắn.
   - Tuân thủ ranh giới folder (`Folder-structure.md`), chiến lược fetch data (`Data-fetching.md`), quy tắc code quality (`Code-quality.md`), và workflow (`Workflow.md`).
   - WMS v1 chỉ có 1 kho trung tâm — không thêm luồng transfer/multi-warehouse trừ khi issue yêu cầu rõ ràng.
   - Put-away suggestion là logic advisory từ backend — FE chỉ render shelf/path/capacity/reason + xác nhận barcode, không tự suy luận nghiệp vụ.
   - Success envelope từ API: `{ data, meta }`, pagination ở `meta.pagination`. Prefix API WMS: `/api/wms`.
   - Nếu issue yêu cầu điều mâu thuẫn với rule bất biến (vd đọc thẳng DB Ecommerce, dựng 3D bin packing), báo lại cho user thay vì tự ý làm.

4. **Triển khai**: code + test theo đúng convention hiện có trong repo (xem file/component tương tự để bắt chước style).

5. **Verify trước khi báo xong** — dùng skill `superpowers:verification-before-completion`: chạy `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` liên quan đến phần đã đổi, xác nhận output thật sự pass, không chỉ giả định. Nếu có thay đổi UI, khởi động `pnpm dev` và kiểm tra trực tiếp trên trình duyệt trước khi báo hoàn thành.

6. **Báo cáo kết quả** cho user, kèm số issue đã tham chiếu.

7. **Hỏi bước tiếp theo** — dùng `AskUserQuestion` hỏi user có muốn commit/push và đóng issue trên GitHub hay không (vd option: "Commit + đóng issue" / "Chỉ commit, không đóng issue" / "Không làm gì thêm"). **Không** tự động commit, push, tạo branch, mở PR hay đóng issue nếu chưa hỏi và được user xác nhận rõ trong lượt này. Nếu user chọn đóng issue, dùng `gh issue close <số> --comment "..."` tóm tắt ngắn gọn thay đổi đã làm.
