
DROP  TABLE IF EXISTS RXNATOMARCHIVE;
CREATE TABLE RXNATOMARCHIVE
(
   RXAUI             varchar(8) NOT NULL,
   AUI               varchar(10),
   STR               varchar(4000) NOT NULL,
   ARCHIVE_TIMESTAMP varchar(280) NOT NULL,
   CREATED_TIMESTAMP varchar(280) NOT NULL,
   UPDATED_TIMESTAMP varchar(280) NOT NULL,
   CODE              varchar(50),
   IS_BRAND          varchar(1),
   LAT               varchar(3),
   LAST_RELEASED     varchar(30),
   SAUI              varchar(50),
   VSAB              varchar(40),
   RXCUI             varchar(8),
   SAB               varchar(20),
   TTY               varchar(20),
   MERGED_TO_RXCUI   varchar(8)
)
;

DROP  TABLE IF EXISTS RXNCONSO;
CREATE TABLE RXNCONSO
(
   RXCUI             varchar(8) NOT NULL,
   LAT               varchar (3) DEFAULT 'ENG' NOT NULL,
   TS                varchar (1),
   LUI               varchar(8),
   STT               varchar (3),
   SUI               varchar (8),
   ISPREF            varchar (1),
   RXAUI             varchar(8) NOT NULL,
   SAUI              varchar (50),
   SCUI              varchar (50),
   SDUI              varchar (50),
   SAB               varchar (20) NOT NULL,
   TTY               varchar (20) NOT NULL,
   CODE              varchar (50) NOT NULL,
   STR               varchar (3000) NOT NULL,
   SRL               varchar (10),
   SUPPRESS          varchar (1),
   CVF               varchar(50)
)
;

DROP  TABLE IF EXISTS  RXNCUICHANGES;
CREATE TABLE RXNCUICHANGES
(
      RXAUI         varchar(8),
      CODE          varchar(50),
      SAB           varchar(20),
      TTY           varchar(20),
      STR           varchar(3000),
      OLD_RXCUI     varchar(8) NOT NULL,
      NEW_RXCUI     varchar(8) NOT NULL
)
;

