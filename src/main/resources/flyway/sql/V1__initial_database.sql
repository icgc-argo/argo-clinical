CREATE TABLE donor
(
    id                UUID UNIQUE NOT NULL,
    submitter_id      VARCHAR(255) NOT NULL,
    program_id        UUID NOT NULL,
    entity_id         SERIAL NOT NULL UNIQUE ,
    PRIMARY KEY (submitter_id, program_id)
);

