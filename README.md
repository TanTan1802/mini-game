# 🎲 Vui Cuối Tuần

Bộ game chơi cùng bạn bè **trong cùng mạng Wi-Fi / LAN**: một máy chạy server, mọi người mở trình duyệt trên điện thoại hoặc máy tính là vào chơi được, không cần cài app.

| Game | Số người | Luật chi tiết |
|---|---|---|
| 🃏 **Tiến Lên Miền Nam** | 2–4 | [docs/luat-choi/tien-len.md](docs/luat-choi/tien-len.md) |
| ♠️ **Poker Texas Hold'em** | 2–8 | [docs/luat-choi/poker.md](docs/luat-choi/poker.md) |
| 🐴 **Cá Ngựa** | 2–4 | [docs/luat-choi/ca-ngua.md](docs/luat-choi/ca-ngua.md) |
| 🏠 **Cờ Tỷ Phú** | 2–6 | [docs/luat-choi/co-ty-phu.md](docs/luat-choi/co-ty-phu.md) |

Luật chơi cũng xem được ngay trong game qua nút **📖 Luật**.

## 🌐 Chơi online (bạn bè ở bất kỳ đâu)

Bấm nút dưới đây để đưa game lên Render (gói miễn phí, cần tạo tài khoản Render bằng GitHub):

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/TanTan1802/mini-game)

1. Bấm nút → đăng nhập Render bằng GitHub → **Apply / Deploy**.
2. Chờ 2–3 phút, Render cấp một link dạng `https://vui-cuoi-tuan-xxxx.onrender.com`.
3. Gửi link đó cho mọi người: mở bằng trình duyệt là chơi, không cần cài gì.

> Gói miễn phí của Render sẽ **ngủ sau ~15 phút không ai vào**. Lần mở đầu tiên sau đó mất khoảng 50 giây để server thức dậy, và các phòng đang mở sẽ bị xoá. Cứ mở link, chờ một chút rồi tạo phòng mới là được.

## 🏠 Chơi trong nhà (cùng Wi-Fi)


Cần [Node.js](https://nodejs.org) 18 trở lên.

```bash
git clone https://github.com/TanTan1802/mini-game.git
```

```bash
cd mini-game
```

```bash
npm install
```

```bash
npm start
```

Màn hình sẽ in ra địa chỉ, ví dụ:

```
🎉  Vui Cuối Tuần đã sẵn sàng!
   Trên máy này:     http://localhost:3000
   Người cùng Wi-Fi: http://192.168.1.23:3000
```

- Người chạy server mở `http://localhost:3000`.
- Bạn bè **cùng Wi-Fi** mở địa chỉ `http://192.168.x.x:3000` ở trên.
- Muốn đổi cổng: `PORT=8080 npm start`.

> Nếu bạn bè không vào được: kiểm tra mọi người cùng mạng Wi-Fi, và cho phép Node.js qua tường lửa (Windows sẽ hỏi lần đầu chạy — chọn **Allow / Cho phép** cho mạng Private).

## Cách chơi

0. **Tạo hình nhân vật:** chạm vào ảnh đại diện ở trang chủ để đặt tên và chọn màu da, kiểu tóc, mắt, miệng, trang phục, phụ kiện (kính, mũ, nón lá, vương miện…). Nhân vật được lưu trên máy bạn và hiện trong mọi game. Ở Cờ Tỷ Phú, nhân vật chính là quân cờ của bạn.
1. Nhập tên → chọn game → **Tạo phòng**. Bạn sẽ nhận một **mã phòng 4 ký tự**.
2. Bạn bè nhập tên + mã phòng → **Vào**. (Chạm vào mã phòng để chép link mời.)
3. Chủ phòng 👑 bấm **Bắt đầu**. Có thể đổi game khác trong cùng phòng, không cần tạo lại.

**Tính năng:**

- 💬 Chat và thả emoji trong lúc chơi.
- 🔄 **Tự kết nối lại:** lỡ tải lại trang hay điện thoại tắt màn hình thì mở lại là quay về đúng ván.
- 🤖 Người **rời phòng** giữa ván thì máy tự đi thay, để ván không bị kẹt.
- 👀 Người vào phòng khi ván đang chơi sẽ được xem, và tham gia từ ván sau.
- 📳 Rung và chuông báo khi tới lượt (có nút 🔊 để tắt âm thanh).
- 🧑‍🎨 Tạo hình nhân vật riêng, đổi được cả khi đang ở trong phòng.
- 🏙️ Cờ Tỷ Phú có bàn cờ 3D: nhà và khách sạn đứng nổi trên đất, quân cờ là nhân vật đi từng ô, tiền thay đổi hiện số bay lên, thẻ Cơ Hội lật ra giữa bàn.
- 🎰 Phong cách sòng bài sang trọng: nền tối, vàng kim, bàn nỉ oval có người chơi ngồi quanh, chip và lá bài chi tiết.
- ✨ Chia bài bay từ giữa bàn, bài trên tay xòe hình quạt, chip cược bay vào pot rồi về người thắng, xúc xắc 3D lăn thật, xu vàng bay khi trả tiền thuê. Có banner "CHẶT!", "ALL-IN!", "ĐÁ NGỰA!", và pháo giấy khi thắng.
- ✨ Ngựa và quân cờ đi từng ô. Nếu thiết bị bật chế độ giảm chuyển động thì animation tự tắt.
- 📱 Giao diện tối ưu cho điện thoại.

## Cấu trúc

```
server/
  index.js          Server HTTP + Socket.io, in địa chỉ LAN
  rooms.js          Phòng chơi, chat, chuyển hành động tới game, tự đi thay người đã rời
  games/            Logic từng game (chạy hoàn toàn ở server, người chơi không gian lận được)
    tienlen.js  poker.js  cangua.js  typhu.js  cards.js
public/
  index.html  css/style.css
  js/avatar.js      Vẽ nhân vật bằng SVG từ vài con số cấu hình
  js/ui.js          Tiện ích giao diện: cập nhật DOM mượt, lá bài, âm thanh
  js/fx.js          Hiệu ứng: xúc xắc 3D, vật bay theo vòng cung, chip, xu, pháo giấy, banner
  js/app.js         Sảnh, phòng chờ, chat
  js/games/         Giao diện từng game
docs/luat-choi/     Luật chơi chi tiết (Markdown)
render.yaml         Cấu hình triển khai lên Render (chơi online)
test/               Test logic: chơi ngẫu nhiên hàng trăm ván để bắt lỗi
```

Server giữ toàn bộ trạng thái và chỉ gửi cho mỗi người phần họ được phép thấy, ví dụ bài trên tay người khác không bao giờ được gửi tới máy bạn.

## Phát triển

```bash
npm run dev
```

```bash
npm test
```

## Thêm game mới

1. Tạo `server/games/<tên>.js`: một class có `static meta`, `action(playerId, action)` (báo lỗi bằng `throw new Error('…')`) và `getState(playerId)`.
2. Đăng ký vào `GAMES` trong `server/rooms.js`.
3. Tạo `public/js/games/<tên>.js` gọi `window.GameViews.<id> = { render(root, state, ctx) }`, rồi thêm thẻ `<script>` vào `index.html`.
4. Viết luật vào `docs/luat-choi/` và khai báo trong `server/index.js`.
