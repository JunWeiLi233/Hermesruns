package com.hermes.backend.training;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.function.Supplier;
import static com.hermes.backend.training.TrainingFailure.check;

/** Internal repository. HTTP controllers never receive raw rows or accept SQL/table names. */
public final class TrainingStore {
    private static final String[] MIGRATIONS={"V001__workspace.sql","V002__postgres_version_guards.sql","V003__canonical_training.sql","V004__activity_provider_compatibility.sql","V005__generated_plan_guards.sql"};
    final JdbcTemplate jdbc;
    final ObjectMapper json;
    final TransactionTemplate tx;
    public TrainingStore(JdbcTemplate jdbc,ObjectMapper json,PlatformTransactionManager manager) {
        this.jdbc=jdbc;this.json=json;this.tx=new TransactionTemplate(manager);
    }
    public void migrate() {
        jdbc.execute("create table if not exists tw_migration(version integer primary key, checksum varchar(64) not null)");
        try {
            var resource=new ClassPathResource("db/training/V001__workspace.sql");
            String checksum=hash(new String(resource.getInputStream().readAllBytes(),StandardCharsets.UTF_8));
            var versions=rows("select checksum from tw_migration where version=1");
            if(!versions.isEmpty())check(checksum.equals(versions.get(0).get("checksum")),500,"MIGRATION_CHECKSUM_CHANGED");
            else{new ResourceDatabasePopulator(resource).execute(Objects.requireNonNull(jdbc.getDataSource()));jdbc.update("insert into tw_migration(version,checksum) values(1,?)",checksum);}
            boolean postgres=Boolean.TRUE.equals(jdbc.execute((org.springframework.jdbc.core.ConnectionCallback<Boolean>)c->c.getMetaData().getDatabaseProductName().equals("PostgreSQL")));
            if(postgres)for(int index=1;index<MIGRATIONS.length;index++){
                String sql;try(var input=new ClassPathResource("db/training/"+MIGRATIONS[index]).getInputStream()){sql=new String(input.readAllBytes(),StandardCharsets.UTF_8);}
                String digest=hash(sql);int version=index+1;var applied=rows("select checksum from tw_migration where version=?",version);
                if(applied.isEmpty())atomic(()->{jdbc.execute(sql);jdbc.update("insert into tw_migration(version,checksum) values(?,?)",version,digest);return true;});
                else check(digest.equals(applied.get(0).get("checksum")),500,"MIGRATION_CHECKSUM_CHANGED");
            }
        } catch(java.io.IOException failure) {throw new IllegalStateException("Migration resource unavailable",failure);}
    }
    public <T> T atomic(Supplier<T> work) { return tx.execute(status->work.get()); }
    public void validateMigrations(){
        boolean postgres=Boolean.TRUE.equals(jdbc.execute((org.springframework.jdbc.core.ConnectionCallback<Boolean>)connection->connection.getMetaData().getDatabaseProductName().equals("PostgreSQL")));
        for(int version=1;version<=(postgres?MIGRATIONS.length:1);version++){
            String resource=MIGRATIONS[version-1];
            try(var input=new ClassPathResource("db/training/"+resource).getInputStream()){
                String expected=hash(new String(input.readAllBytes(),StandardCharsets.UTF_8));
                check(expected.equals(one("select checksum from tw_migration where version=?",version).get("checksum")),500,"MIGRATION_CHECKSUM_CHANGED");
            }catch(java.io.IOException failure){throw new IllegalStateException("Migration resource unavailable",failure);}
        }
    }
    public Map<String,Object> command(String actor,String operation,String key,Map<String,Object> body,Runnable authorize,Supplier<Map<String,Object>> work) {return atomic(()->{
        check(key!=null&&key.matches("[a-zA-Z0-9:_-]{8,80}"),428,"IDEMPOTENCY_KEY_REQUIRED");authorize.run();
        String hash;try{hash=hash(json.writer().with(com.fasterxml.jackson.databind.SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS).writeValueAsString(body));}catch(Exception e){throw new TrainingFailure(422,"INVALID_DOCUMENT");}
        var old=rows("select * from tw_receipt where actor_id=? and operation=? and client_key=?",actor,operation,key);
        if(!old.isEmpty()){check(hash.equals(old.get(0).get("request_hash")),409,"IDEMPOTENCY_KEY_REUSED");check(((Number)old.get(0).get("expires_at")).longValue()>System.currentTimeMillis(),409,"RECEIPT_EXPIRED");return object(old.get(0).get("result"));}
        // A uniqueness conflict rolls back the command transaction; a retry then reads the winner.
        jdbc.update("insert into tw_receipt(actor_id,operation,client_key,request_hash,result,expires_at) values(?,?,?,?,?,?)",actor,operation,key,hash,"{}",System.currentTimeMillis()+86400000);
        var result=work.get();jdbc.update("update tw_receipt set result=? where actor_id=? and operation=? and client_key=?",encode(result),actor,operation,key);return result;
    });}
    List<Map<String,Object>> rows(String sql,Object...args) {
        return jdbc.query(sql,(rs,n)->{
            var row=new LinkedHashMap<String,Object>();var meta=rs.getMetaData();
            for(int i=1;i<=meta.getColumnCount();i++)row.put(meta.getColumnLabel(i).toLowerCase(Locale.ROOT),rs.getObject(i));return row;
        },args);
    }
    Map<String,Object> one(String sql,Object...args) {var list=rows(sql,args);check(!list.isEmpty(),404,"NOT_FOUND");return list.get(0);}
    void lock(String subject) {one("select id from tw_profile where id=? for update",id(subject));}
    void lockAll(Collection<String> subjects) {subjects.stream().distinct().sorted().forEach(this::lock);}
    public String ensure(long runnerId,String name,String zone) {return atomic(()->{
        // Serialize first use against the existing identity row; never create another password authority.
        one("select id from runner where id=? for update",runnerId);
        var existing=rows("select id from tw_profile where runner_id=?",runnerId);
        if(!existing.isEmpty())return (String)existing.get(0).get("id");
        String id=uuid();var settings=map("name",name==null||name.isBlank()?"Athlete":name,"zone",zone==null?"UTC":zone,
            "units","metric","maxHr",190,"ftp",240,"fitnessTau",42,"fatigueTau",7,"discoverable",false,"routePrivate",true,"notifications",false);
        jdbc.update("insert into tw_profile(id,runner_id,settings) values(?,?,?)",id,runnerId,encode(settings));return id;
    });}
    public Map<String,Object> profile(String id) {var row=one("select * from tw_profile where id=?",id(id));var dto=object(row.get("settings"));
        dto.put("id",id);dto.put("revision",row.get("revision"));dto.put("dataRevision",row.get("data_revision"));return dto;}
    public long runner(String id) {return ((Number)one("select runner_id from tw_profile where id=?",id(id)).get("runner_id")).longValue();}
    long revision(String id) {return ((Number)one("select data_revision from tw_profile where id=?",id).get("data_revision")).longValue();}
    void touch(String id) {jdbc.update("update tw_profile set data_revision=data_revision+1 where id=?",id);}
    void audit(String actor,String subject,String action) {jdbc.update("insert into tw_audit(id,actor_id,subject_id,action,occurred_at) values(?,?,?,?,?)",uuid(),actor,subject,action,System.currentTimeMillis());}
    public Map<String,Object> object(Object value) {try{return json.readValue(String.valueOf(value),new TypeReference<LinkedHashMap<String,Object>>(){});}catch(Exception e){throw new TrainingFailure(500,"STORED_DOCUMENT_INVALID");}}
    @SuppressWarnings("unchecked") public List<Map<String,Object>> objects(Object value) {try{return json.readValue(String.valueOf(value),new TypeReference<List<Map<String,Object>>>(){});}catch(Exception e){throw new TrainingFailure(500,"STORED_DOCUMENT_INVALID");}}
    List<String> strings(Object value) {try{return json.readValue(String.valueOf(value),new TypeReference<List<String>>(){});}catch(Exception e){throw new TrainingFailure(500,"STORED_DOCUMENT_INVALID");}}
    public String encode(Object value) {try{return json.writeValueAsString(value);}catch(Exception e){throw new TrainingFailure(422,"INVALID_DOCUMENT");}}
    static String uuid() {return UUID.randomUUID().toString();}
    public static String id(String value) {try{return UUID.fromString(value).toString();}catch(Exception e){throw new TrainingFailure(422,"INVALID_ID");}}
    public static String hash(String text) {try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
    public static Map<String,Object> map(Object... values) {var m=new LinkedHashMap<String,Object>();for(int i=0;i<values.length;i+=2)m.put((String)values[i],values[i+1]);return m;}
    public static String text(Map<String,Object> body,String key,int max) {Object v=body.get(key);check(v instanceof String,422,"INVALID_"+key);String s=((String)v).trim();check(!s.isBlank()&&s.length()<=max&&!s.chars().anyMatch(c->c<32 && c!='\n'&&c!='\t'),422,"INVALID_"+key);return s;}
    public static double number(Map<String,Object> body,String key,double min,double max) {Object v=body.get(key);double n;try{n=Double.parseDouble(String.valueOf(v));}catch(Exception e){throw new TrainingFailure(422,"INVALID_"+key);}check(Double.isFinite(n)&&n>=min&&n<=max,422,"INVALID_"+key);return n;}
    public static void fields(Map<String,Object> body,String... allowed) {check(body!=null&&body.size()<=40&&Set.of(allowed).containsAll(body.keySet()),422,"UNEXPECTED_FIELDS");}
    static void match(long expected,Map<String,Object> row,String key) {check(((Number)row.get(key)).longValue()==expected,412,"STALE_REVISION");}
    static List<String> mask(List<String> fields) {check(fields!=null&&fields.size()<=3&&Set.of("sleep","restingHr","feeling").containsAll(fields),422,"INVALID_WELLNESS_SCOPE");return fields.stream().distinct().sorted().toList();}
}
