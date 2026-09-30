CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


INSERT INTO companies (name)
VALUES ('Hawk''n Technologies');


CREATE TABLE company_profiles (
    id SERIAL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    company_id INTEGER NOT NULL UNIQUE,
    official_company_name VARCHAR(255) NOT NULL,
    official_email VARCHAR(255) NOT NULL,
    vision TEXT,
    mission TEXT,
    blog_content TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_company_profiles_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE
);

CREATE TABLE company_policies (
    id SERIAL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    company_id INTEGER NOT NULL UNIQUE,
    content TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_company_policies_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE
);

CREATE TABLE company_roles_responsibilities (
    id SERIAL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    company_id INTEGER NOT NULL UNIQUE,
    content TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_company_roles_responsibilities_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE
);

CREATE TABLE employee_hierarchy_images (
    id SERIAL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    company_id INTEGER NOT NULL,
    original_file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    storage_key TEXT,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_employee_hierarchy_images_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE
);



CREATE TABLE roles (
    id SERIAL PRIMARY KEY,

    uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


INSERT INTO roles (name, description)
VALUES
    ('admin', 'System administrator'),
    ('bde', 'Business Development Executive'),
    ('client', 'Client user'),
    ('developer', 'Developer'),
    ('hr', 'Human Resources'),
    ('project_lead', 'Project lead'),
    ('tester', 'Software tester');



    CREATE TABLE users (
    id SERIAL PRIMARY KEY,

    uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),

    company_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,

    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),

    email VARCHAR(255) NOT NULL,
    password_hash TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_users_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_users_role
        FOREIGN KEY (role_id)
        REFERENCES roles(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_users_company_email
        UNIQUE (company_id, email)
);





CREATE TABLE employees (
    id SERIAL PRIMARY KEY,

    uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),

    user_id INTEGER NOT NULL UNIQUE,
    company_id INTEGER NOT NULL,

    phone1 VARCHAR(30),
    phone2 VARCHAR(30),
    whatsapp VARCHAR(30),

    joining_date DATE,
    date_of_birth DATE,

    linkedin_url TEXT,
    github_url TEXT,

    aadhaar_last4 VARCHAR(4),

    employment_type VARCHAR(30) NOT NULL DEFAULT 'Full Time',
    employment_status VARCHAR(30) NOT NULL DEFAULT 'Active',

    photo_url TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_employees_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_employees_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_employment_type
        CHECK (employment_type IN ('Full Time', 'Intern', 'Probation')),

    CONSTRAINT chk_employment_status
        CHECK (employment_status IN ('Active', 'On Leave', 'Exited')),

    CONSTRAINT chk_aadhaar_last4
        CHECK (aadhaar_last4 IS NULL OR aadhaar_last4 ~ '^[0-9]{4}$'),

    CONSTRAINT uq_employees_company_user
        UNIQUE (company_id, user_id)
);
