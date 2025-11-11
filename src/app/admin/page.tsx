import React from "react";
import ItemImportForm from "~/components/admin/ItemImportForm";

const Admin = () => {

    return(
        <div className="container mx-auto py-10">
            <h1 className="text-3xl font-bold mb-8">Admin Panel</h1>
            
            <div className="space-y-8">
                <ItemImportForm />
            </div>
        </div>
    )
}

export default Admin;