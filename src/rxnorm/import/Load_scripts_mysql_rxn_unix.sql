load data local infile 'RXNATOMARCHIVE.RRF' into table RXNATOMARCHIVE fields terminated by '|' 
ESCAPED BY 'ä'
lines terminated by '\n'
(@rxaui,@aui,@str,@archive_timestamp,@created_timestamp,@updated_timestamp,@code,@is_brand,@lat,@last_released,@saui,@vsab,@rxcui,@sab,@tty,@merged_to_rxcui)
SET rxaui =@rxaui,
    aui =@aui,
    str =@str,
    archive_timestamp =@archive_timestamp,
    created_timestamp =@created_timestamp,
    updated_timestamp =@updated_timestamp,
    code =@code,
    is_brand =@is_brand,
    lat =@lat,
    last_released =@last_released,
    saui =@saui,
    vsab =@vsab,
    rxcui =@rxcui,
    sab =@sab,
    tty =@tty,
    merged_to_rxcui =@merged_to_rxcui;


load data local infile 'RXNCONSO.RRF' into table RXNCONSO fields terminated by '|' 
ESCAPED BY 'ä'
lines terminated by '\n'
(@rxcui,@lat,@ts,@lui,@stt,@sui,@ispref,@rxaui,@saui,@scui,@sdui,@sab,@tty,@code,@str,@srl,@suppress,@cvf)
SET rxcui =@rxcui,
    lat =@lat,
    ts =@ts,
    lui =@lui,
    stt =@stt,
    sui =@sui,
    ispref =@ispref,
    rxaui =@rxaui,
    saui =@saui,
    scui =@scui,
    sdui =@sdui,
    sab =@sab,
    tty =@tty,
    code =@code,
    str =@str,
    srl =@srl,
    suppress=@suppress,
    cvf=@cvf;

load data local infile 'RXNCUICHANGES.RRF' into table RXNCUICHANGES fields terminated by '|' 
ESCAPED BY 'ä'
lines terminated by '\n'
(@rxaui,@code,@sab,@tty,@str,@old_rxcui,@new_rxcui)
SET rxaui=@rxaui,
    code =@code,
    sab =@sab,
    tty =@tty,
    str =@str,
    old_rxcui =@old_rxcui,
    new_rxcui =@new_rxcui ;

