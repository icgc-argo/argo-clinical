CREATE TABLE donor
(
    entity_id         SERIAL PRIMARY KEY,
    id                UUID UNIQUE ,
    submitter_id      VARCHAR(255) NOT NULL,
    program_id        UUID NOT NULL
);

