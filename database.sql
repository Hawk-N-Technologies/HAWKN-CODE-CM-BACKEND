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
    company_email VARCHAR(255),
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


CREATE TABLE employee_onboarding (
    id SERIAL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    employee_id INTEGER NOT NULL UNIQUE,
    company_id INTEGER NOT NULL,
    offer_letter_signed BOOLEAN NOT NULL DEFAULT FALSE,
    documents_submitted BOOLEAN NOT NULL DEFAULT FALSE,
    documents_verified BOOLEAN NOT NULL DEFAULT FALSE,
    system_access_given BOOLEAN NOT NULL DEFAULT FALSE,
    induction_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_employee_onboarding_employee
        FOREIGN KEY (employee_id)
        REFERENCES employees(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_employee_onboarding_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);


CREATE TABLE attendances (
    id SERIAL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    employee_id INTEGER NOT NULL,
    company_id INTEGER NOT NULL,
    attendance_date DATE NOT NULL,
    session VARCHAR(20) NOT NULL,
    check_in TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'Present',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_attendance_employee
        FOREIGN KEY (employee_id)
        REFERENCES employees(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_attendance_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,
    CONSTRAINT chk_attendance_session
        CHECK (session IN ('FIRST_HALF', 'SECOND_HALF')),
    CONSTRAINT chk_attendance_status
        CHECK (status IN ('Present', 'Absent')),
    CONSTRAINT uq_employee_attendance_session
        UNIQUE (employee_id, attendance_date, session)
);



CREATE TABLE payrolls (
    id SERIAL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    company_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    pay_period DATE NOT NULL,
    base_salary NUMERIC(12,2) NOT NULL,
    lop_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
    bonus NUMERIC(12,2) NOT NULL DEFAULT 0,
    net_salary NUMERIC(12,2) NOT NULL,
    payment_method VARCHAR(30) NOT NULL DEFAULT 'Bank Transfer',
    status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    processed_at TIMESTAMP WITH TIME ZONE,
    created_by INTEGER,
    processed_by INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payrolls_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_payrolls_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_payrolls_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_payrolls_processed_by
        FOREIGN KEY (processed_by)
        REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT uq_payrolls_company_user_period
        UNIQUE (company_id, user_id, pay_period),
    CONSTRAINT chk_payrolls_period_first_of_month
        CHECK (EXTRACT(DAY FROM pay_period) = 1),
    CONSTRAINT chk_payrolls_amounts_non_negative
        CHECK (base_salary >= 0 AND lop_deduction >= 0 AND bonus >= 0),
    CONSTRAINT chk_payrolls_lop_within_base
        CHECK (lop_deduction <= base_salary),
    CONSTRAINT chk_payrolls_net_formula
        CHECK (net_salary = base_salary - lop_deduction + bonus),
    CONSTRAINT chk_payrolls_payment_method
        CHECK (payment_method IN ('Bank Transfer', 'UPI', 'Cheque', 'Cash')),
    CONSTRAINT chk_payrolls_status
        CHECK (status IN ('Pending', 'Processed')),
    CONSTRAINT chk_payrolls_processed_consistency
        CHECK ((status = 'Processed') = (processed_at IS NOT NULL))
);
CREATE INDEX idx_payrolls_company_period ON payrolls (company_id, pay_period);



CREATE TABLE company_holidays (
    id SERIAL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    company_id INTEGER NOT NULL,
    holiday_date DATE NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_paid BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_company_holidays_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,
    CONSTRAINT uq_company_holiday
        UNIQUE (company_id, holiday_date)
);



CREATE TABLE employee_salaries (
    id SERIAL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    employee_id INTEGER NOT NULL UNIQUE,
    salary NUMERIC(12,2) NOT NULL,
    CONSTRAINT fk_employee_salaries_employee
        FOREIGN KEY (employee_id)
        REFERENCES employees(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT chk_employee_salaries_salary_positive
        CHECK (salary > 0)
);



CREATE TABLE employee_leaves (
    id SERIAL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    employee_id INTEGER NOT NULL,
    company_id INTEGER NOT NULL,
    leave_date DATE NOT NULL,
    leave_type VARCHAR(30) NOT NULL,
    leave_session VARCHAR(20) NOT NULL DEFAULT 'FULL_DAY',
    leave_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    -- NULL while PENDING or REJECTED
    -- TRUE/FALSE after HR approves
    is_paid BOOLEAN,
    reason TEXT,
    reviewed_by INTEGER,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_employee_leave_employee
        FOREIGN KEY (employee_id)
        REFERENCES employees(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_employee_leave_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_employee_leave_reviewer
        FOREIGN KEY (reviewed_by)
        REFERENCES users(id)
        ON DELETE SET NULL,
    CONSTRAINT chk_employee_leave_status
        CHECK (
            leave_status IN (
                'PENDING',
                'APPROVED',
                'REJECTED'
            )
        ),
    CONSTRAINT chk_employee_leave_type
        CHECK (
            leave_type IN (
                'CASUAL',
                'SICK',
                'ANNUAL',
                'UNPAID',
                'OTHER'
            )
        ),
    CONSTRAINT chk_employee_leave_session
        CHECK (
            leave_session IN (
                'FULL_DAY',
                'FIRST_HALF',
                'SECOND_HALF'
            )
        )
);





CREATE TABLE employee_bonuses (
    id SERIAL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    company_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    pay_period DATE NOT NULL,
    bonus_type VARCHAR(30) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    reason TEXT,
    created_by INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_employee_bonuses_company
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_employee_bonuses_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_employee_bonuses_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_employee_bonuses_amount_positive CHECK (amount > 0),
    CONSTRAINT chk_employee_bonuses_period_first_of_month CHECK (EXTRACT(DAY FROM pay_period) = 1),
    CONSTRAINT chk_employee_bonuses_type
        CHECK (bonus_type IN ('Performance', 'Festival', 'Referral', 'Joining', 'Other'))
);
CREATE INDEX idx_employee_bonuses_user_period ON employee_bonuses (company_id, user_id, pay_period);

CREATE TABLE salary_increments (
    id SERIAL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    employee_id INTEGER NOT NULL,
    previous_salary NUMERIC(12,2) NOT NULL,
    new_salary NUMERIC(12,2) NOT NULL,
    effective_date DATE NOT NULL,
    reason TEXT,
    created_by INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_salary_increments_employee
        FOREIGN KEY (employee_id) REFERENCES employees(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_salary_increments_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_salary_increments_previous_positive CHECK (previous_salary > 0),
    CONSTRAINT chk_salary_increments_is_increase CHECK (new_salary > previous_salary)
);
CREATE INDEX idx_salary_increments_employee ON salary_increments (employee_id);

CREATE TABLE internship_probation_periods (
    id SERIAL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    company_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    period_type VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    original_end_date DATE NOT NULL,
    extension_count INTEGER NOT NULL DEFAULT 0,
    stipend NUMERIC(12,2),
    performance VARCHAR(30) NOT NULL DEFAULT 'Pending',
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    closed_at TIMESTAMP WITH TIME ZONE,
    created_by INTEGER,
    closed_by INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ipp_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_ipp_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_ipp_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_ipp_closed_by FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_ipp_type CHECK (period_type IN ('Internship', 'Probation')),
    CONSTRAINT chk_ipp_status CHECK (status IN ('Active', 'Confirmed', 'Converted', 'Ended', 'Terminated')),
    CONSTRAINT chk_ipp_performance CHECK (performance IN ('Pending', 'Needs Improvement', 'Good', 'Excellent')),
    CONSTRAINT chk_ipp_dates CHECK (end_date > start_date AND original_end_date > start_date),
    CONSTRAINT chk_ipp_extension CHECK (extension_count >= 0 AND end_date >= original_end_date),
    CONSTRAINT chk_ipp_stipend CHECK (stipend IS NULL OR (period_type = 'Internship' AND stipend >= 0)),
    CONSTRAINT chk_ipp_converted_only_internship CHECK (status NOT IN ('Converted', 'Ended') OR period_type = 'Internship'),
    CONSTRAINT chk_ipp_closed_consistency CHECK ((status = 'Active') = (closed_at IS NULL))
);
-- Only ONE active period per employee
CREATE UNIQUE INDEX uq_ipp_one_active_per_employee
    ON internship_probation_periods (employee_id) WHERE status = 'Active';
CREATE INDEX idx_ipp_company_status_end
    ON internship_probation_periods (company_id, status, end_date);



CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL UNIQUE,
    company_id INTEGER NOT NULL,
    phone VARCHAR(30),
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_clients_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_clients_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,
    CONSTRAINT uq_clients_company_user
        UNIQUE (company_id, user_id)
);





CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    company_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    project_lead_id INTEGER,
    tier VARCHAR(30) NOT NULL DEFAULT 'Tier I',
    start_date DATE,
    deadline DATE,
    internal_deadline DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'Planning',
    progress INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_projects_company
        FOREIGN KEY (company_id)
        REFERENCES companies(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_projects_client
        FOREIGN KEY (client_id)
        REFERENCES clients(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_projects_lead
        FOREIGN KEY (project_lead_id)
        REFERENCES employees(id)
        ON DELETE SET NULL,
    CONSTRAINT chk_projects_tier
        CHECK (tier IN ('Tier I', 'Tier II', 'Tier III')),
    CONSTRAINT chk_projects_status
        CHECK (
            status IN (
                'Planning',
                'In Development',
                'Testing',
                'Completed',
                'On Hold',
                'Cancelled'
            )
        ),
    CONSTRAINT chk_projects_progress
        CHECK (progress >= 0 AND progress <= 100),
    CONSTRAINT chk_project_dates
        CHECK (
            deadline IS NULL
            OR start_date IS NULL
            OR deadline >= start_date
        )
);

