
-- Sơ đồ cơ sở dữ liệu cho hệ thống VietinBank Management
-- Sử dụng cho việc tham chiếu hoặc triển khai các hệ thống SQL tương đương

-- 1. Bảng Hồ sơ Cán bộ (Users)
CREATE TABLE users (
    uid VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    ad_account VARCHAR(100),
    role VARCHAR(50) DEFAULT 'staff', -- Vai trò: 'director', 'manager', 'staff'
    is_admin BOOLEAN DEFAULT FALSE,
    avatar_url TEXT,
    department VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng Nhiệm vụ (Tasks)
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    assignee_id VARCHAR(255) REFERENCES users(uid),
    assignee_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Đang làm', -- 'Đang làm', 'Chờ duyệt', 'Hoàn thành', 'Từ chối'
    priority VARCHAR(50) DEFAULT 'Trung bình', -- 'Khẩn cấp', 'Cao', 'Trung bình'
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    due_date DATE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bảng Mục tiêu KPIs (Goals)
CREATE TABLE goals (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    assignee VARCHAR(255), -- Có thể là tên phòng ban hoặc tên cá nhân
    type VARCHAR(100), -- 'Kinh doanh', 'Vận hành', 'Công nghệ'
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    status VARCHAR(100), -- 'Đúng tiến độ', 'Cần chú ý', 'Vượt mức'
    deadline DATE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Bảng Nhật ký trao đổi (Comments - Nếu lưu riêng)
CREATE TABLE task_comments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    sender_id VARCHAR(255) REFERENCES users(uid),
    sender_name VARCHAR(255),
    text TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
