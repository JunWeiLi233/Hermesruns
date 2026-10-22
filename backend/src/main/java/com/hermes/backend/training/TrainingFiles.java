package com.hermes.backend.training;

import java.nio.file.*;

/** Account-independent erasure tombstones: deletion failures retain a durable retry handle. */
final class TrainingFiles {
    static void enqueue(TrainingStore db,String id){
        TrainingStore.id(id);if(db.rows("select id from tw_file_cleanup where id=?",id).isEmpty())db.jdbc.update("insert into tw_file_cleanup(id) values(?)",id);
    }
    static void sweep(TrainingStore db,Path directory){
        var tx=new org.springframework.transaction.support.TransactionTemplate(db.tx.getTransactionManager());tx.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        tx.execute(status->{sweepRows(db,directory);return true;});
    }
    private static void sweepRows(TrainingStore db,Path directory){
        Path root=directory.toAbsolutePath().normalize();
        for(var row:db.rows("select id from tw_file_cleanup order by id fetch first 100 rows only")){
            String id=TrainingStore.id((String)row.get("id"));Path target=root.resolve(id+".upload").normalize();
            if(!target.startsWith(root))continue;
            try{Files.deleteIfExists(target);if(!Files.exists(target))db.jdbc.update("delete from tw_file_cleanup where id=?",id);}catch(java.io.IOException ignored){/* Retain tombstone, retry next tick. */}
        }
    }
}
