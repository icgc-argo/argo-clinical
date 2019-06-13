CREATE TABLE donor
(
    id                UUID PRIMARY KEY,
    simple_id         SERIAL NOT NULL UNIQUE,
    submitter_id      VARCHAR(255) NOT NULL UNIQUE,
    program_id        UUID NOT NULL
);

