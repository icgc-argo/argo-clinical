CREATE SEQUENCE donor_entity_id_seq INCREMENT 1 START 1 MINVALUE 1;
CREATE TABLE donor
(
    id                UUID PRIMARY KEY,
    simple_id         INTEGER NOT NULL UNIQUE DEFAULT nextval('donor_entity_id_seq'),
    submitter_id      VARCHAR(255) NOT NULL UNIQUE,
    program_id        UUID NOT NULL
);

