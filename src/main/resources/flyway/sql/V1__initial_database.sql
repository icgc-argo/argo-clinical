CREATE SEQUENCE donor_entity_id_seq INCREMENT 1 START 1 MINVALUE 1;
CREATE TABLE donor
(
    id                UUID PRIMARY KEY ,
    entity_id         INTEGER DEFAULT nextval('donor_entity_id_seq'),
    submitter_id      VARCHAR(255) NOT NULL,
    program_id        UUID NOT NULL
);

